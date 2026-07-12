import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
@Injectable()
export class NotificationsService{
  constructor(private readonly database:DatabaseService){}
  async list(userId:string,unreadOnly=false):Promise<unknown[]>{
    return(await this.database.query(`SELECT n.id, n.type, n.title, n.body, n.entity_type, n.entity_id, n.created_at, r.read_at 
      FROM notifications n JOIN notification_recipients r ON n.id=r.notification_id 
      WHERE r.admin_user_id=$1 AND ($2=FALSE OR r.read_at IS NULL) ORDER BY n.created_at DESC LIMIT 100`,[userId,unreadOnly])).rows;
  }
  async read(id:string,userId:string):Promise<unknown>{
    const result=await this.database.query(`UPDATE notification_recipients SET read_at=NOW() WHERE notification_id=$1
      AND admin_user_id=$2 RETURNING *`,[id,userId]);
    if(!result.rows[0])throw new NotFoundException('Notification not found');
    return this.database.query(`SELECT n.id, n.type, n.title, n.body, n.entity_type, n.entity_id, n.created_at, r.read_at 
      FROM notifications n JOIN notification_recipients r ON n.id=r.notification_id 
      WHERE n.id=$1 AND r.admin_user_id=$2`, [id, userId]).then(r => r.rows[0]);
  }
  async readAll(userId:string):Promise<void>{
    await this.database.query(`UPDATE notification_recipients SET read_at=NOW() WHERE read_at IS NULL AND admin_user_id=$1`,[userId]);
  }
}
