import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class IdempotencyKeyCleanupService{
  private readonly logger=new Logger(IdempotencyKeyCleanupService.name);
  constructor(private readonly database:DatabaseService){}
  async run():Promise<number>{
    const result=await this.database.transaction(async(client)=>{
      const lock=await client.query<{locked:boolean}>('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked',['idempotency-key-cleanup']);
      if(!lock.rows[0]?.locked)return 0;
      return(await client.query('DELETE FROM idempotency_keys WHERE expires_at<=NOW()')).rowCount??0;
    });
    if(result)this.logger.log(`Deleted ${result} expired idempotency keys`);
    return result;
  }
}
