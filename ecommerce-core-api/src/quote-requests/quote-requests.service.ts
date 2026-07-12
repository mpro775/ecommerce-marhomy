import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService, DbExecutor } from '../database/database.service';
import { allowedStatusTransitions, assertQuoteQuantity, assertSpamSafe, assertStatusTransition, QuoteStatus, sanitizeText } from '../common/domain/quote-rules';
import type { RequestContext } from '../common/utils/request-context';
import type { AuthUser } from '../auth/auth.types';
import type { CreateQuoteNoteDto, ListQuoteRequestsQuery, SubmitQuoteRequestDto, UpdateAssigneeDto, UpdateContactDto, UpdateQuoteStatusDto } from './dto';
import * as ExcelJS from 'exceljs';
interface CartRow{id:string;status:string;expires_at:Date|null}
interface ItemRow{id:string;product_id:string;variant_id:string|null;quantity:string;unit_snapshot:string;item_note:string|null;
  selected_options:Record<string,unknown>;title_ar:string;title_en:string|null;sku:string|null;specifications:Record<string,unknown>;
  product_status:string;quote_enabled:boolean;availability_status:string;minimum_request_quantity:string;
  maximum_request_quantity:string|null;quantity_step:string;variant_title_ar:string|null;variant_title_en:string|null;
  variant_sku:string|null;variant_attributes:Record<string,unknown>|null;variant_active:boolean|null;image_url:string|null}
export interface QuoteSubmissionResult{requestNumber:string;trackingToken:string;status:string;submittedAt:string}
@Injectable()
export class QuoteRequestsService{
  constructor(private readonly database:DatabaseService,private readonly config:ConfigService){}
  async submit(input:SubmitQuoteRequestDto,idempotencyKey:string,context:RequestContext):Promise<QuoteSubmissionResult>{
    this.validateSubmission(input,idempotencyKey);
    const requestHash=createHash('sha256').update(this.canonicalJson(input)).digest('hex');
    return this.database.transaction(async(client)=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[idempotencyKey]);
      const previous=await client.query<{request_hash:string;response_body:QuoteSubmissionResult}>(
        `SELECT request_hash,response_body FROM idempotency_keys WHERE scope='quote_request' AND idempotency_key=$1 AND expires_at>NOW() FOR UPDATE`,[idempotencyKey]);
      if(previous.rows[0]){
        if(previous.rows[0].request_hash!==requestHash)throw new ConflictException('Idempotency key was used with a different request');
        return previous.rows[0].response_body;
      }
      const cartResult=await client.query<CartRow>('SELECT id,status,expires_at FROM quote_carts WHERE public_token=$1 FOR UPDATE',[input.cartToken]);
      const cart=cartResult.rows[0];if(!cart)throw new NotFoundException('Quote cart not found');
      if(cart.status!=='open')throw new BadRequestException('Quote cart is not open');
      if(cart.expires_at&&new Date(cart.expires_at).getTime()<=Date.now())throw new BadRequestException('Quote cart has expired');
      const itemsResult=await client.query<ItemRow>(`SELECT i.*,p.title_ar,p.title_en,p.sku,p.specifications,p.status AS product_status,
        p.quote_enabled,p.availability_status,p.minimum_request_quantity,p.maximum_request_quantity,p.quantity_step,
        v.title_ar AS variant_title_ar,v.title_en AS variant_title_en,v.sku AS variant_sku,v.attributes AS variant_attributes,
        v.is_active AS variant_active,(SELECT image_url FROM product_images WHERE product_id=p.id ORDER BY is_primary DESC,sort_order LIMIT 1) AS image_url
        FROM quote_cart_items i JOIN products p ON p.id=i.product_id LEFT JOIN product_variants v ON v.id=i.variant_id
        WHERE i.quote_cart_id=$1 ORDER BY i.created_at FOR UPDATE OF i`,[cart.id]);
      if(!itemsResult.rows.length)throw new BadRequestException('Quote cart is empty');
      for(const item of itemsResult.rows)this.validateItem(item);
      const phone=this.normalizePhone(input.phone);
      const email=input.email?.toLowerCase()??null;
      const contact=await client.query<{id:string}>(`INSERT INTO contacts(full_name,phone,email,company_name,city,preferred_contact_method,first_request_at,last_request_at)
        VALUES($1,$2,$3,$4,$5,$6,NOW(),NOW()) ON CONFLICT(phone) DO UPDATE SET
        full_name=EXCLUDED.full_name,email=COALESCE(EXCLUDED.email,contacts.email),
        company_name=COALESCE(EXCLUDED.company_name,contacts.company_name),city=COALESCE(EXCLUDED.city,contacts.city),
        preferred_contact_method=COALESCE(EXCLUDED.preferred_contact_method,contacts.preferred_contact_method),
        last_request_at=NOW(),updated_at=NOW() RETURNING id`,[sanitizeText(input.fullName,200),phone,email,
        sanitizeText(input.companyName,255),sanitizeText(input.city,150),input.preferredContactMethod??null]);
      const timezone=this.config.get<string>('APP_TIMEZONE','Asia/Aden');
      const yearResult=await client.query<{year:number}>(`SELECT date_part('year',timezone($1,CURRENT_TIMESTAMP))::int AS year`,[timezone]);
      const year=yearResult.rows[0].year;const sequence=await client.query<{last_value:number}>(`INSERT INTO quote_request_sequences(request_year,last_value)
        VALUES($1,1) ON CONFLICT(request_year) DO UPDATE SET last_value=quote_request_sequences.last_value+1 RETURNING last_value`,[year]);
      const requestNumber=this.config.get<string>('QUOTE_REQUEST_PREFIX','RFQ')+'-'+year+'-'+String(sequence.rows[0].last_value).padStart(6,'0');
      const trackingToken=randomBytes(32).toString('base64url');const submittedAt=new Date().toISOString();
      const request=await client.query<{id:string}>(`INSERT INTO quote_requests(request_number,public_token,contact_id,full_name,phone,email,
        company_name,city,address_text,delivery_notes,preferred_contact_method,customer_note,source,submitted_at,requester_ip,requester_user_agent)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,[requestNumber,trackingToken,contact.rows[0].id,
        sanitizeText(input.fullName,200),phone,input.email?.toLowerCase()??null,sanitizeText(input.companyName,255),sanitizeText(input.city,150),
        sanitizeText(input.addressText,1000),sanitizeText(input.deliveryNotes,1000),input.preferredContactMethod??null,
        sanitizeText(input.customerNote,3000),sanitizeText(input.source,30)??'web',submittedAt,context.ipAddress,context.userAgent]);
      const requestId=request.rows[0].id;
      for(let index=0;index<itemsResult.rows.length;index++){const item=itemsResult.rows[index];
        await client.query(`INSERT INTO quote_request_items(quote_request_id,product_id,variant_id,product_title_snapshot,
          variant_title_snapshot,sku_snapshot,image_url_snapshot,attributes_snapshot,quantity,unit_snapshot,item_note,sort_order)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[requestId,item.product_id,item.variant_id,item.title_ar,
          item.variant_title_ar,item.variant_sku??item.sku,item.image_url,{specifications:item.specifications,selectedOptions:item.selected_options,
          variantAttributes:item.variant_attributes??{}},item.quantity,item.unit_snapshot,item.item_note,index]);}
      await client.query(`INSERT INTO quote_request_status_history(quote_request_id,new_status,note) VALUES($1,'new','Request submitted')`,[requestId]);
      await client.query(`UPDATE quote_carts SET status='submitted',submitted_at=NOW(),updated_at=NOW() WHERE id=$1`,[cart.id]);
      const notification=await client.query<{id:string}>(`INSERT INTO notifications(type,title,body,entity_type,entity_id)
        VALUES('quote_request_new',$1,$2,'quote_request',$3) RETURNING id`,['New quote request '+requestNumber,'A new quote request has been submitted',requestId]);
      await client.query(`INSERT INTO notification_recipients(notification_id,admin_user_id) SELECT $1,id FROM admin_users WHERE is_active=TRUE AND deleted_at IS NULL`,[notification.rows[0].id]);
      await client.query(`INSERT INTO notification_deliveries(notification_id,channel,status) VALUES($1,'in_app','sent')`,[notification.rows[0].id]);
      await client.query(`INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload)
        VALUES('quote_request_submitted','quote_request',$1,$2)`,[requestId,{requestNumber,fullName:input.fullName,phone,email:input.email??null,itemCount:itemsResult.rows.length}]);
      await client.query(`INSERT INTO catalog_events(event_name,quote_cart_id,quote_request_id,source,city,metadata)
        VALUES('quote_request_submitted',$1,$2,$3,$4,$5)`,[cart.id,requestId,input.source??'web',sanitizeText(input.city,150),{itemCount:itemsResult.rows.length}]);
      const response:QuoteSubmissionResult={requestNumber,trackingToken,status:'new',submittedAt};
      await client.query(`INSERT INTO idempotency_keys(scope,idempotency_key,request_hash,response_code,response_body,expires_at)
        VALUES('quote_request',$1,$2,201,$3,NOW()+INTERVAL '24 hours')`,[idempotencyKey,requestHash,response]);
      return response;
    });
  }
  async publicStatus(requestNumber:string,token:string):Promise<unknown>{
    const result=await this.database.query(`SELECT request_number,status,submitted_at,updated_at FROM quote_requests
      WHERE request_number=$1 AND public_token=$2`,[requestNumber,token]);
    if(!result.rows[0])throw new NotFoundException('Quote request not found');return result.rows[0];
  }
  async list(query:ListQuoteRequestsQuery):Promise<{items:unknown[];count:number;page:number;pageSize:number}>{
    const page=query.page??1,pageSize=query.pageSize??50,values:unknown[]=[];const where:string[]=[];
    if(query.status){values.push(query.status);where.push('q.status=$'+values.length);}
    if(query.search){values.push('%'+query.search+'%');where.push('(q.request_number ILIKE $'+values.length+' OR q.phone ILIKE $'+values.length+' OR q.full_name ILIKE $'+values.length+')');}
    if(query.assigneeId){values.push(query.assigneeId);where.push('q.assigned_to_admin_user_id=$'+values.length);}
    const clause=where.length?'WHERE '+where.join(' AND '):'';
    const countResult=await this.database.query<{count:string}>('SELECT COUNT(*)::text AS count FROM quote_requests q '+clause,values);
    values.push(pageSize,(page-1)*pageSize);
    const result=await this.database.query(`SELECT q.*,u.full_name AS assignee_name,
      (SELECT COUNT(*)::int FROM quote_request_items WHERE quote_request_id=q.id) AS item_count
      FROM quote_requests q LEFT JOIN admin_users u ON u.id=q.assigned_to_admin_user_id `+clause+
      ' ORDER BY q.created_at DESC LIMIT $'+(values.length-1)+' OFFSET $'+values.length,values);
    return{items:result.rows,count:Number(countResult.rows[0]?.count??0),page,pageSize};
  }
  async detail(id:string):Promise<unknown>{
    const result=await this.database.query(`SELECT q.*,u.full_name AS assignee_name,
      COALESCE((SELECT json_agg(i ORDER BY i.sort_order) FROM quote_request_items i WHERE i.quote_request_id=q.id),'[]') AS items,
      COALESCE((SELECT json_agg(h ORDER BY h.created_at) FROM quote_request_status_history h WHERE h.quote_request_id=q.id),'[]') AS history,
      COALESCE((SELECT json_agg(jsonb_build_object('id',n.id,'content',n.content,'created_at',n.created_at,'admin_user_id',n.admin_user_id,'admin_name',a.full_name)
        ORDER BY n.created_at) FROM quote_request_notes n LEFT JOIN admin_users a ON a.id=n.admin_user_id WHERE n.quote_request_id=q.id),'[]') AS notes
      FROM quote_requests q LEFT JOIN admin_users u ON u.id=q.assigned_to_admin_user_id WHERE q.id=$1`,[id]);
    const request=result.rows[0] as({status:QuoteStatus}&Record<string,unknown>)|undefined;
    if(!request)throw new NotFoundException('Quote request not found');
    return{...request,allowedTransitions:allowedStatusTransitions(request.status)};
  }
  async updateStatus(id:string,input:UpdateQuoteStatusDto,user:AuthUser):Promise<unknown>{
    return this.database.transaction(async(client)=>{
      const current=await client.query<{status:QuoteStatus;request_number:string}>('SELECT status,request_number FROM quote_requests WHERE id=$1 FOR UPDATE',[id]);
      if(!current.rows[0])throw new NotFoundException('Quote request not found');
      assertStatusTransition(current.rows[0].status,input.status);
      const updated=await client.query(`UPDATE quote_requests SET status=$2,
        first_reviewed_at=CASE WHEN first_reviewed_at IS NULL AND $2='in_review' THEN NOW() ELSE first_reviewed_at END,
        last_contacted_at=CASE WHEN $2='contacted' THEN NOW() ELSE last_contacted_at END,
        closed_at=CASE WHEN $2='closed' THEN NOW() ELSE closed_at END,updated_at=NOW() WHERE id=$1 RETURNING *`,[id,input.status]);
      await client.query(`INSERT INTO quote_request_status_history(quote_request_id,old_status,new_status,changed_by_admin_user_id,note)
        VALUES($1,$2,$3,$4,$5)`,[id,current.rows[0].status,input.status,user.id,sanitizeText(input.note,1000)]);
      const notification=await client.query<{id:string}>(`INSERT INTO notifications(type,title,body,entity_type,entity_id)
        VALUES('quote_request_status_changed',$1,$2,'quote_request',$3) RETURNING id`,
        ['Quote request '+current.rows[0].request_number,'Status changed to '+input.status,id]);
      await client.query(`INSERT INTO notification_recipients(notification_id,admin_user_id) SELECT $1,id FROM admin_users WHERE is_active=TRUE AND deleted_at IS NULL`,[notification.rows[0].id]);
      await client.query(`INSERT INTO notification_deliveries(notification_id,channel,status) VALUES($1,'in_app','sent')`,[notification.rows[0].id]);
      await client.query(`INSERT INTO audit_logs(admin_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'quote_request.status_changed','quote_request',$2,$3)`,[user.id,id,{from:current.rows[0].status,to:input.status}]);
      await this.addEvent(client,'quote_request_status_changed',id,{requestNumber:current.rows[0].request_number,status:input.status});
      return updated.rows[0];
    });
  }
  async assign(id:string,input:UpdateAssigneeDto,user:AuthUser):Promise<unknown>{
    return this.database.transaction(async(client)=>{
      if(input.adminUserId){const admin=await client.query('SELECT id FROM admin_users WHERE id=$1 AND is_active=TRUE AND deleted_at IS NULL',[input.adminUserId]);
        if(!admin.rows[0])throw new BadRequestException('Assignee is not an active admin user');}
      const updated=await client.query(`UPDATE quote_requests SET assigned_to_admin_user_id=$2,updated_at=NOW() WHERE id=$1 RETURNING *`,[id,input.adminUserId??null]);
      if(!updated.rows[0])throw new NotFoundException('Quote request not found');
      if(input.adminUserId){const notification=await client.query<{id:string}>(`INSERT INTO notifications(type,title,body,entity_type,entity_id)
        VALUES('quote_request_assigned','Quote request assigned','A quote request was assigned to you','quote_request',$1) RETURNING id`,[id]);
        await client.query(`INSERT INTO notification_recipients(notification_id,admin_user_id) VALUES($1,$2)`,[notification.rows[0].id,input.adminUserId]);
        await client.query(`INSERT INTO notification_deliveries(notification_id,channel,status) VALUES($1,'in_app','sent')`,[notification.rows[0].id]);}
      await client.query(`INSERT INTO audit_logs(admin_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'quote_request.assigned','quote_request',$2,$3)`,[user.id,id,{assigneeId:input.adminUserId??null}]);
      await this.addEvent(client,'quote_request_assigned',id,{assigneeId:input.adminUserId??null,assignedBy:user.id});return updated.rows[0];
    });
  }
  async note(id:string,input:CreateQuoteNoteDto,user:AuthUser):Promise<unknown>{
    const content=sanitizeText(input.content,3000);if(!content)throw new BadRequestException('Note is empty');
    return this.database.transaction(async(client)=>{
      const result=await client.query(`INSERT INTO quote_request_notes(quote_request_id,admin_user_id,content)
        SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM quote_requests WHERE id=$1) RETURNING *`,[id,user.id,content]);
      if(!result.rows[0])throw new NotFoundException('Quote request not found');
      const notification=await client.query<{id:string}>(`INSERT INTO notifications(type,title,body,entity_type,entity_id)
        VALUES('quote_request_note_added','Internal note added','A note was added to a quote request','quote_request',$1) RETURNING id`,[id]);
      await client.query(`INSERT INTO notification_recipients(notification_id,admin_user_id) SELECT $1,id FROM admin_users WHERE is_active=TRUE AND deleted_at IS NULL`,[notification.rows[0].id]);
      await client.query(`INSERT INTO notification_deliveries(notification_id,channel,status) VALUES($1,'in_app','sent')`,[notification.rows[0].id]);
      await client.query(`INSERT INTO audit_logs(admin_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'quote_request.note_added','quote_request',$2,$3)`,[user.id,id,{noteId:result.rows[0].id}]);
      return result.rows[0];
    });
  }
  async history(id:string):Promise<unknown[]>{return(await this.database.query(`SELECT h.*,u.full_name AS changed_by_name
    FROM quote_request_status_history h LEFT JOIN admin_users u ON u.id=h.changed_by_admin_user_id
    WHERE h.quote_request_id=$1 ORDER BY h.created_at`,[id])).rows;}
  async exportWorkbook(query:ListQuoteRequestsQuery):Promise<Buffer>{
    const values:unknown[]=[];const where:string[]=[];
    if(query.status){values.push(query.status);where.push('q.status=$'+values.length);}
    if(query.search){values.push('%'+query.search+'%');where.push('(q.request_number ILIKE $'+values.length+' OR q.phone ILIKE $'+values.length+' OR q.full_name ILIKE $'+values.length+')');}
    if(query.assigneeId){values.push(query.assigneeId);where.push('q.assigned_to_admin_user_id=$'+values.length);}
    const clause=where.length?'WHERE '+where.join(' AND '):'';
    const result=await this.database.query(`SELECT q.*,u.full_name AS assignee_name,
      (SELECT COUNT(*)::int FROM quote_request_items WHERE quote_request_id=q.id) AS item_count
      FROM quote_requests q LEFT JOIN admin_users u ON u.id=q.assigned_to_admin_user_id `+clause+
      ' ORDER BY q.created_at DESC',values);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Quote Requests');
    if (result.rows.length > 0) {
      sheet.columns = Object.keys(result.rows[0]).map(key => ({ header: key, key }));
      sheet.addRows(result.rows);
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
  async contacts(search=''):Promise<unknown[]>{return(await this.database.query(`SELECT c.*,
    (SELECT COUNT(*)::int FROM quote_requests q WHERE q.contact_id=c.id) AS request_count
    FROM contacts c WHERE $1='' OR c.full_name ILIKE $2 OR c.phone ILIKE $2 OR c.email ILIKE $2 ORDER BY c.last_request_at DESC NULLS LAST`,
    [search,'%'+search+'%'])).rows;}
  async contact(id:string):Promise<unknown>{const result=await this.database.query(`SELECT c.*,
    COALESCE((SELECT json_agg(q ORDER BY q.created_at DESC) FROM quote_requests q WHERE q.contact_id=c.id),'[]') AS requests
    FROM contacts c WHERE c.id=$1`,[id]);if(!result.rows[0])throw new NotFoundException('Contact not found');return result.rows[0];}
  async updateContact(id:string,input:UpdateContactDto):Promise<unknown>{
    const result=await this.database.query(`UPDATE contacts SET full_name=COALESCE($2,full_name),email=COALESCE($3,email),
      company_name=COALESCE($4,company_name),city=COALESCE($5,city),preferred_contact_method=COALESCE($6,preferred_contact_method),
      updated_at=NOW() WHERE id=$1 RETURNING *`,[id,sanitizeText(input.fullName,200),input.email?.toLowerCase()??null,
      sanitizeText(input.companyName,255),sanitizeText(input.city,150),input.preferredContactMethod??null]);
    if(!result.rows[0])throw new NotFoundException('Contact not found');return result.rows[0];
  }
  private validateSubmission(input:SubmitQuoteRequestDto,key:string):void{
    if(!key||key.length<8||key.length>150)throw new BadRequestException('Valid Idempotency-Key header is required');
    if(input.website)throw new BadRequestException('Request rejected');
    const minimum=this.config.get<number>('QUOTE_MIN_FORM_FILL_MS',1500);
    if(Date.now()-new Date(input.formStartedAt).getTime()<minimum)throw new BadRequestException('Form was submitted too quickly');
    assertSpamSafe(sanitizeText(input.customerNote,3000));
  }
  private validateItem(item:ItemRow):void{
    if(item.product_status!=='published'||!item.quote_enabled||['temporarily_unavailable','discontinued'].includes(item.availability_status))
      throw new BadRequestException('A cart product is no longer available');
    if(item.variant_id&&item.variant_active!==true)throw new BadRequestException('A selected variant is no longer active');
    assertQuoteQuantity(Number(item.quantity),Number(item.minimum_request_quantity),
      item.maximum_request_quantity===null?null:Number(item.maximum_request_quantity),Number(item.quantity_step));
  }
  private normalizePhone(phone:string):string{return phone.replace(/[\s()-]/g,'');}
  private canonicalJson(value:unknown):string{
    if(Array.isArray(value))return'['+value.map((item)=>this.canonicalJson(item)).join(',')+']';
    if(value&&typeof value==='object'){const record=value as Record<string,unknown>;return'{'+Object.keys(record).sort()
      .map((key)=>JSON.stringify(key)+':'+this.canonicalJson(record[key])).join(',')+'}';}
    return JSON.stringify(value);
  }
  private async addEvent(client:DbExecutor,type:string,id:string,payload:Record<string,unknown>):Promise<void>{
    await client.query(`INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload) VALUES($1,'quote_request',$2,$3)`,[type,id,payload]);
    await client.query(`INSERT INTO catalog_events(event_name,quote_request_id,metadata) VALUES($1,$2,$3)`,[type,id,payload]);
  }
}
