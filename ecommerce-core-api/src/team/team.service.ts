import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../email/email.service';
import type { AuthUser } from '../auth/auth.types';
import type { AcceptInviteDto, InviteAdminDto, ResetPasswordDto, UpdateAdminDto } from './dto';
@Injectable()
export class TeamService{
  constructor(private readonly database:DatabaseService,private readonly email:EmailService,private readonly config:ConfigService){}
  async users():Promise<unknown[]>{return(await this.database.query(`SELECT u.id,u.email,u.full_name,u.is_active,u.last_login_at,u.created_at,
    COALESCE(array_agg(DISTINCT r.name) FILTER(WHERE r.name IS NOT NULL),'{}') AS roles
    FROM admin_users u LEFT JOIN admin_user_roles ur ON ur.admin_user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id
    WHERE u.deleted_at IS NULL GROUP BY u.id ORDER BY u.created_at`)).rows;}
  async roles():Promise<unknown[]>{return(await this.database.query(`SELECT r.*,COALESCE(array_agg(p.code) FILTER(WHERE p.code IS NOT NULL),'{}') AS permissions
    FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id GROUP BY r.id ORDER BY r.name`)).rows;}
  async invite(input:InviteAdminDto,actor:AuthUser):Promise<{id:string;expiresAt:Date}>{
    const exists=await this.database.query('SELECT id FROM admin_users WHERE LOWER(email)=LOWER($1) AND deleted_at IS NULL',[input.email]);
    if(exists.rows[0])throw new ConflictException('Admin user already exists');
    const role=await this.database.query<{id:string}>('SELECT id FROM roles WHERE name=$1',[input.roleName]);
    if(!role.rows[0])throw new BadRequestException('Role not found');
    const token=randomBytes(36).toString('base64url'),hash=this.hash(token),expiresAt=new Date(Date.now()+72*3600000);
    const result=await this.database.query<{id:string}>(`INSERT INTO admin_invites(email,full_name,token_hash,role_id,invited_by_admin_user_id,expires_at)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[input.email.toLowerCase(),input.fullName,hash,role.rows[0].id,actor.id,expiresAt]);
    await this.email.send([input.email],'Admin invitation','Accept your invitation: '+this.config.get<string>('APP_URL')+'/accept-invite?token='+token);
    return{id:result.rows[0].id,expiresAt};
  }
  async accept(input:AcceptInviteDto):Promise<void>{
    const passwordHash=await argon2.hash(input.password,{type:argon2.argon2id});
    await this.database.transaction(async(client)=>{
      const invite=await client.query<{id:string;email:string;full_name:string;role_id:string}>(`SELECT id,email,full_name,role_id FROM admin_invites
        WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at>NOW() FOR UPDATE`,[this.hash(input.token)]);
      if(!invite.rows[0])throw new BadRequestException('Invitation is invalid or expired');
      const user=await client.query<{id:string}>(`INSERT INTO admin_users(email,full_name,password_hash) VALUES($1,$2,$3) RETURNING id`,
        [invite.rows[0].email,invite.rows[0].full_name,passwordHash]);
      await client.query('INSERT INTO admin_user_roles(admin_user_id,role_id) VALUES($1,$2)',[user.rows[0].id,invite.rows[0].role_id]);
      await client.query('UPDATE admin_invites SET accepted_at=NOW() WHERE id=$1',[invite.rows[0].id]);
    });
  }
  async update(id:string,input:UpdateAdminDto):Promise<unknown>{
    return this.database.transaction(async(client)=>{
      const current=await client.query('SELECT id FROM admin_users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id]);
      if(!current.rows[0])throw new NotFoundException('Admin user not found');
      if(input.isActive!==undefined)await client.query('UPDATE admin_users SET is_active=$2,updated_at=NOW() WHERE id=$1',[id,input.isActive]);
      if(input.roles){const roles=await client.query<{id:string}>('SELECT id FROM roles WHERE name=ANY($1::text[])',[input.roles]);
        if(roles.rows.length!==input.roles.length)throw new BadRequestException('One or more roles are invalid');
        await client.query('DELETE FROM admin_user_roles WHERE admin_user_id=$1',[id]);
        for(const role of roles.rows)await client.query('INSERT INTO admin_user_roles(admin_user_id,role_id) VALUES($1,$2)',[id,role.id]);}
      return(await client.query('SELECT id,email,full_name,is_active FROM admin_users WHERE id=$1',[id])).rows[0];
    });
  }
  async requestReset(email:string):Promise<void>{
    const user=await this.database.query<{id:string;email:string}>('SELECT id,email FROM admin_users WHERE LOWER(email)=LOWER($1) AND is_active=TRUE AND deleted_at IS NULL',[email]);
    if(!user.rows[0])return;const token=randomBytes(36).toString('base64url');
    await this.database.query(`INSERT INTO admin_password_resets(admin_user_id,token_hash,expires_at)
      VALUES($1,$2,NOW()+INTERVAL '1 hour')`,[user.rows[0].id,this.hash(token)]);
    await this.email.send([user.rows[0].email],'Password reset','Reset your password: '+this.config.get<string>('APP_URL')+'/reset-password?token='+token);
  }
  async reset(input:ResetPasswordDto):Promise<void>{
    const passwordHash=await argon2.hash(input.password,{type:argon2.argon2id});
    await this.database.transaction(async(client)=>{
      const reset=await client.query<{id:string;admin_user_id:string}>(`SELECT id,admin_user_id FROM admin_password_resets
        WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW() FOR UPDATE`,[this.hash(input.token)]);
      if(!reset.rows[0])throw new BadRequestException('Reset token is invalid or expired');
      await client.query('UPDATE admin_users SET password_hash=$2,updated_at=NOW() WHERE id=$1',[reset.rows[0].admin_user_id,passwordHash]);
      await client.query('UPDATE admin_password_resets SET used_at=NOW() WHERE id=$1',[reset.rows[0].id]);
      await client.query('UPDATE admin_sessions SET revoked_at=NOW(),updated_at=NOW() WHERE admin_user_id=$1 AND revoked_at IS NULL',[reset.rows[0].admin_user_id]);
    });
  }
  private hash(value:string):string{return createHash('sha256').update(value).digest('hex');}
}
