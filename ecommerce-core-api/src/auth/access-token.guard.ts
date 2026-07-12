import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import type { AccessPayload, AuthenticatedRequest, AuthUser } from './auth.types';
interface UserRow{id:string;email:string;full_name:string;roles:string[];permissions:string[];session_id:string}
@Injectable()
export class AccessTokenGuard implements CanActivate{
  constructor(private readonly jwt:JwtService,private readonly database:DatabaseService){}
  async canActivate(context:ExecutionContext):Promise<boolean>{
    const request=context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header=request.headers.authorization;
    if(!header?.startsWith('Bearer '))throw new UnauthorizedException('Bearer token is required');
    let payload:AccessPayload;
    try{payload=await this.jwt.verifyAsync<AccessPayload>(header.slice(7));}
    catch{throw new UnauthorizedException('Invalid or expired access token');}
    const result=await this.database.query<UserRow>(`SELECT u.id,u.email,u.full_name,s.id AS session_id,
      COALESCE(array_agg(DISTINCT r.name) FILTER(WHERE r.name IS NOT NULL),'{}') AS roles,
      COALESCE(array_agg(DISTINCT p.code) FILTER(WHERE p.code IS NOT NULL),'{}') AS permissions
      FROM admin_users u JOIN admin_sessions s ON s.admin_user_id=u.id
      LEFT JOIN admin_user_roles ur ON ur.admin_user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id
      LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id
      WHERE u.id=$1 AND s.id=$2 AND u.is_active=TRUE AND u.deleted_at IS NULL
        AND s.revoked_at IS NULL AND s.expires_at>NOW()
      GROUP BY u.id,s.id`,[payload.sub,payload.sid]);
    const row=result.rows[0];if(!row)throw new UnauthorizedException('Session is not active');
    const user:AuthUser={id:row.id,email:row.email,fullName:row.full_name,roles:row.roles,
      permissions:row.permissions,sessionId:row.session_id};
    request.user=user;return true;
  }
}
