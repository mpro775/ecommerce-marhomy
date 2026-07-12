import { Injectable } from '@nestjs/common';
import { DatabaseService, type DbExecutor } from '../database/database.service';
interface UserRecord{id:string;email:string;full_name:string;password_hash:string;is_active:boolean;roles:string[];permissions:string[]}
interface SessionRecord{id:string;admin_user_id:string;refresh_token_hash:string;expires_at:Date;revoked_at:Date|null}
@Injectable()
export class AuthRepository{
  constructor(private readonly database:DatabaseService){}
  async findUserByEmail(email:string):Promise<UserRecord|null>{
    const result=await this.database.query<UserRecord>(`SELECT u.id,u.email,u.full_name,u.password_hash,u.is_active,
      COALESCE(array_agg(DISTINCT r.name) FILTER(WHERE r.name IS NOT NULL),'{}') AS roles,
      COALESCE(array_agg(DISTINCT p.code) FILTER(WHERE p.code IS NOT NULL),'{}') AS permissions
      FROM admin_users u LEFT JOIN admin_user_roles ur ON ur.admin_user_id=u.id
      LEFT JOIN roles r ON r.id=ur.role_id LEFT JOIN role_permissions rp ON rp.role_id=r.id
      LEFT JOIN permissions p ON p.id=rp.permission_id
      WHERE LOWER(u.email)=LOWER($1) AND u.deleted_at IS NULL GROUP BY u.id LIMIT 1`,[email]);
    return result.rows[0]??null;
  }
  async findUserById(id:string,executor:DbExecutor=this.database):Promise<UserRecord|null>{
    const result=await executor.query<UserRecord>(`SELECT u.id,u.email,u.full_name,u.password_hash,u.is_active,
      COALESCE(array_agg(DISTINCT r.name) FILTER(WHERE r.name IS NOT NULL),'{}') AS roles,
      COALESCE(array_agg(DISTINCT p.code) FILTER(WHERE p.code IS NOT NULL),'{}') AS permissions
      FROM admin_users u LEFT JOIN admin_user_roles ur ON ur.admin_user_id=u.id
      LEFT JOIN roles r ON r.id=ur.role_id LEFT JOIN role_permissions rp ON rp.role_id=r.id
      LEFT JOIN permissions p ON p.id=rp.permission_id
      WHERE u.id=$1 AND u.deleted_at IS NULL GROUP BY u.id LIMIT 1`,[id]);
    return result.rows[0]??null;
  }
  async createSession(input:{id:string;userId:string;hash:string;expiresAt:Date;ip:string|null;agent:string|null}):Promise<void>{
    await this.database.query(`INSERT INTO admin_sessions(id,admin_user_id,refresh_token_hash,expires_at,ip_address,user_agent)
      VALUES($1,$2,$3,$4,$5,$6)`,[input.id,input.userId,input.hash,input.expiresAt,input.ip,input.agent]);
  }
  async findSession(id:string,executor:DbExecutor=this.database,lock=false):Promise<SessionRecord|null>{
    const result=await executor.query<SessionRecord>('SELECT id,admin_user_id,refresh_token_hash,expires_at,revoked_at FROM admin_sessions WHERE id=$1'+(lock?' FOR UPDATE':''),[id]);
    return result.rows[0]??null;
  }
  async rotateSession(id:string,hash:string,expiresAt:Date,ip:string|null,agent:string|null,executor:DbExecutor=this.database):Promise<void>{
    await executor.query(`UPDATE admin_sessions SET refresh_token_hash=$2,expires_at=$3,ip_address=$4,user_agent=$5,
      rotation_counter=rotation_counter+1,last_seen_at=NOW(),updated_at=NOW() WHERE id=$1`,[id,hash,expiresAt,ip,agent]);
  }
  async revokeSession(id:string):Promise<void>{await this.database.query('UPDATE admin_sessions SET revoked_at=NOW(),updated_at=NOW() WHERE id=$1',[id]);}
  async touchLogin(id:string):Promise<void>{await this.database.query('UPDATE admin_users SET last_login_at=NOW(),updated_at=NOW() WHERE id=$1',[id]);}
}
