import { Injectable } from '@nestjs/common';
import { DatabaseService, DbExecutor } from '../database/database.service';
import type { RequestContext } from '../common/utils/request-context';
@Injectable()
export class AuditService{
  constructor(private readonly database:DatabaseService){}
  async log(input:{adminUserId?:string|null;action:string;entityType?:string;entityId?:string;
    metadata?:Record<string,unknown>;context?:RequestContext;executor?:DbExecutor}):Promise<void>{
    const executor=input.executor??this.database;
    await executor.query(`INSERT INTO audit_logs(admin_user_id,action,entity_type,entity_id,ip_address,user_agent,metadata)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[input.adminUserId??null,input.action,input.entityType??null,input.entityId??null,
      input.context?.ipAddress??null,input.context?.userAgent??null,input.metadata??{}]);
  }
  async list(limit=100):Promise<unknown[]>{
    const result=await this.database.query(`SELECT a.*,u.full_name AS actor_name FROM audit_logs a
      LEFT JOIN admin_users u ON u.id=a.admin_user_id ORDER BY a.created_at DESC LIMIT $1`,[Math.min(limit,500)]);
    return result.rows;
  }
}
