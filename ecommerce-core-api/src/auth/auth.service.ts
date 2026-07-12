import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'node:crypto';
import { AuthRepository } from './auth.repository';
import type { AuthResult, AuthUser } from './auth.types';
import type { RequestContext } from '../common/utils/request-context';
import { DatabaseService, type DbExecutor } from '../database/database.service';
export interface IssuedAuthResult extends AuthResult{refreshToken:string}
@Injectable()
export class AuthService{
  constructor(private readonly repository:AuthRepository,private readonly jwt:JwtService,private readonly config:ConfigService,
    private readonly database:DatabaseService){}
  async login(email:string,password:string,context:RequestContext):Promise<IssuedAuthResult>{
    const record=await this.repository.findUserByEmail(email.trim().toLowerCase());
    if(!record||!record.is_active||!(await argon2.verify(record.password_hash,password))){
      await this.log('auth.login_failed',record?.id??null,context);throw new UnauthorizedException('Invalid credentials');
    }
    await this.repository.touchLogin(record.id);
    const result=await this.issue({id:record.id,email:record.email,fullName:record.full_name,roles:record.roles,permissions:record.permissions,sessionId:''},context);
    await this.log('auth.login_succeeded',record.id,context);return result;
  }
  async refresh(token:string,context:RequestContext):Promise<IssuedAuthResult>{
    const [sessionId,secret]=token.split('.',2);if(!sessionId||!secret)throw new UnauthorizedException('Invalid refresh token');
    const result=await this.database.transaction(async(client)=>{
      const session=await this.repository.findSession(sessionId,client,true);
      if(!session||session.revoked_at||new Date(session.expires_at).getTime()<=Date.now()||
        !(await argon2.verify(session.refresh_token_hash,secret)))throw new UnauthorizedException('Refresh token is not active');
      const record=await this.repository.findUserById(session.admin_user_id,client);
      if(!record||!record.is_active)throw new UnauthorizedException('User is inactive');
      return this.issue({id:record.id,email:record.email,fullName:record.full_name,roles:record.roles,
        permissions:record.permissions,sessionId},context,sessionId,client);
    });
    await this.log('auth.refresh_succeeded',result.user.id,context);return result;
  }
  async logout(user:AuthUser,context:RequestContext):Promise<void>{await this.repository.revokeSession(user.sessionId);await this.log('auth.logout',user.id,context);}
  private async issue(user:AuthUser,context:RequestContext,fixedId?:string,executor?:DbExecutor):Promise<IssuedAuthResult>{
    const sessionId=fixedId??randomUUID();const secret=randomBytes(36).toString('base64url');
    const hash=await argon2.hash(secret,{type:argon2.argon2id});
    const expiresAt=new Date(Date.now()+this.config.get<number>('REFRESH_TOKEN_TTL_DAYS',30)*86400000);
    if(fixedId)await this.repository.rotateSession(sessionId,hash,expiresAt,context.ipAddress,context.userAgent,executor);
    else await this.repository.createSession({id:sessionId,userId:user.id,hash,expiresAt,ip:context.ipAddress,agent:context.userAgent});
    const sessionUser={...user,sessionId};
    const accessToken=await this.jwt.signAsync({sub:user.id,sid:sessionId,email:user.email,fullName:user.fullName});
    return{accessToken,refreshToken:sessionId+'.'+secret,user:sessionUser};
  }
  private async log(action:string,userId:string|null,context:RequestContext):Promise<void>{
    await this.database.query(`INSERT INTO audit_logs(admin_user_id,action,ip_address,user_agent,metadata)
      VALUES($1,$2,$3,$4,$5)`,[userId,action,context.ipAddress,context.userAgent,context.requestId?{requestId:context.requestId}:{}]);
  }
}
