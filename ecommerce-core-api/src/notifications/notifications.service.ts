import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
@Injectable()
export class NotificationsService{
  constructor(private readonly database:DatabaseService){}
  async list(userId:string,unreadOnly=false):Promise<unknown[]>{
    return(await this.database.query(`SELECT * FROM notifications WHERE (admin_user_id IS NULL OR admin_user_id=$1)
      AND ($2=FALSE OR read_at IS NULL) ORDER BY created_at DESC LIMIT 100`,[userId,unreadOnly])).rows;
  }
  async read(id:string,userId:string):Promise<unknown>{
    const result=await this.database.query(`UPDATE notifications SET read_at=NOW() WHERE id=$1
      AND (admin_user_id IS NULL OR admin_user_id=$2) RETURNING *`,[id,userId]);
    if(!result.rows[0])throw new NotFoundException('Notification not found');return result.rows[0];
  }
  async readAll(userId:string):Promise<void>{
    await this.database.query(`UPDATE notifications SET read_at=NOW() WHERE read_at IS NULL AND (admin_user_id IS NULL OR admin_user_id=$1)`,[userId]);
  }
}
