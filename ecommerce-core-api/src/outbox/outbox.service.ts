import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../email/email.service';
interface OutboxRow{id:string;event_type:string;payload:Record<string,unknown>;attempt_count:number}
@Injectable()
export class OutboxService{
  private readonly logger=new Logger(OutboxService.name);
  constructor(private readonly database:DatabaseService,private readonly email:EmailService,private readonly config:ConfigService){}
  async processBatch(limit=25):Promise<number>{
    await this.createOverdueNotifications();
    const events=await this.database.transaction(async(client)=>{
      const result=await client.query<OutboxRow>(`SELECT id,event_type,payload,attempt_count FROM outbox_events
        WHERE status IN ('pending','failed') AND available_at<=NOW() ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED`,[limit]);
      if(result.rows.length)await client.query(`UPDATE outbox_events SET status='processing',updated_at=NOW() WHERE id=ANY($1::uuid[])`,[result.rows.map((row)=>row.id)]);
      return result.rows;
    });
    for(const event of events){
      try{await this.deliver(event);await this.database.query(`UPDATE outbox_events SET status='sent',processed_at=NOW(),updated_at=NOW() WHERE id=$1`,[event.id]);}
      catch(error){const message=error instanceof Error?error.message:String(error);const delay=Math.min(3600,Math.pow(2,event.attempt_count+1)*30);
        await this.database.query(`UPDATE outbox_events SET status='failed',attempt_count=attempt_count+1,last_error=$2,
          available_at=NOW()+($3::text||' seconds')::interval,updated_at=NOW() WHERE id=$1`,[event.id,message,delay]);
        this.logger.error('Outbox delivery failed: '+message);}
    }return events.length;
  }
  private async deliver(event:OutboxRow):Promise<void>{
    const recipients=(this.config.get<string>('QUOTE_NOTIFICATION_EMAILS','')??'').split(',').map((item)=>item.trim()).filter(Boolean);
    const requestNumber=String(event.payload.requestNumber??'');
    if(event.event_type==='quote_request_submitted')await this.sendEmail(recipients,'New quote request '+requestNumber,
      'A new quote request was submitted by '+String(event.payload.fullName??'')+'. Items: '+String(event.payload.itemCount??''));
    else if(event.event_type==='quote_request_status_changed')await this.sendEmail(recipients,'Quote request updated '+requestNumber,
      'The request status changed to '+String(event.payload.status??''));
    else if(event.event_type==='quote_request_assigned')await this.sendEmail(recipients,'Quote request assigned',
      'A quote request was assigned to a team member.');
  }
  private async sendEmail(recipients:string[],subject:string,body:string):Promise<void>{
    if(!recipients.length)return;
    try{
      await this.email.send(recipients,subject,body);
      await this.database.query(`INSERT INTO notification_deliveries(channel,destination,status,attempt_count,sent_at)
        VALUES('email',$1,'sent',1,NOW())`,[recipients.join(',')]);
    }catch(error){
      await this.database.query(`INSERT INTO notification_deliveries(channel,destination,status,attempt_count,last_error)
        VALUES('email',$1,'failed',1,$2)`,[recipients.join(','),error instanceof Error?error.message:String(error)]);
      throw error;
    }
  }
  private async createOverdueNotifications():Promise<void>{
    await this.database.query(`INSERT INTO notifications(type,title,body,entity_type,entity_id)
      SELECT 'quote_request_review_overdue','Quote request needs review','A new quote request has waited more than two hours',
        'quote_request',q.id FROM quote_requests q
      WHERE q.status='new' AND q.submitted_at<NOW()-INTERVAL '2 hours'
        AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.type='quote_request_review_overdue' AND n.entity_id=q.id)`);
    await this.database.query(`INSERT INTO notifications(type,title,body,entity_type,entity_id)
      SELECT 'quote_request_contact_overdue','Customer contact is overdue','A quote request has not been contacted within one day',
        'quote_request',q.id FROM quote_requests q
      WHERE q.status IN ('new','in_review') AND q.submitted_at<NOW()-INTERVAL '1 day'
        AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.type='quote_request_contact_overdue' AND n.entity_id=q.id)`);
  }
}
