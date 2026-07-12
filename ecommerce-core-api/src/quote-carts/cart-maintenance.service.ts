import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';

export interface CartMaintenanceResult{expired:number;archived:number;suspicious:number}

@Injectable()
export class CartMaintenanceService{
  private readonly logger=new Logger(CartMaintenanceService.name);
  constructor(private readonly database:DatabaseService,private readonly config:ConfigService){}
  async run():Promise<CartMaintenanceResult>{
    const retentionDays=this.config.get<number>('QUOTE_CART_RETENTION_DAYS',180);
    const visitorLimit=this.config.get<number>('QUOTE_CART_VISITOR_HOURLY_LIMIT',10);
    const activityLimit=this.config.get<number>('QUOTE_CART_ACTIVITY_HOURLY_LIMIT',100);
    const result=await this.database.transaction(async(client)=>{
      const lock=await client.query<{locked:boolean}>('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked',['quote-cart-maintenance']);
      if(!lock.rows[0]?.locked)return{expired:0,archived:0,suspicious:0};
      const expired=await client.query(`UPDATE quote_carts SET status='expired',updated_at=NOW()
        WHERE status='open' AND expires_at IS NOT NULL AND expires_at<=NOW()`);
      const suspiciousVisitors=await client.query(`WITH noisy_visitors AS(
          SELECT visitor_id FROM quote_carts WHERE visitor_id IS NOT NULL AND created_at>=NOW()-INTERVAL '1 hour'
          GROUP BY visitor_id HAVING COUNT(*)>$1
        ) UPDATE quote_carts q SET is_suspicious=TRUE,suspicion_reason=COALESCE(q.suspicion_reason,'excessive_cart_creation'),updated_at=NOW()
        FROM noisy_visitors n WHERE q.visitor_id=n.visitor_id AND q.created_at>=NOW()-INTERVAL '1 hour' AND NOT q.is_suspicious`,[visitorLimit]);
      const suspiciousActivity=await client.query(`WITH noisy_carts AS(
          SELECT quote_cart_id FROM catalog_events WHERE quote_cart_id IS NOT NULL AND created_at>=NOW()-INTERVAL '1 hour'
            AND event_name IN('quote_item_added','quote_item_updated','quote_item_removed')
          GROUP BY quote_cart_id HAVING COUNT(*)>$1
        ) UPDATE quote_carts q SET is_suspicious=TRUE,suspicion_reason=COALESCE(q.suspicion_reason,'excessive_cart_activity'),updated_at=NOW()
        FROM noisy_carts n WHERE q.id=n.quote_cart_id AND NOT q.is_suspicious`,[activityLimit]);
      const archived=await client.query(`UPDATE quote_carts SET archived_at=NOW()
        WHERE archived_at IS NULL AND ((status='expired' AND updated_at<NOW()-($1::text||' days')::interval)
          OR (status='submitted' AND submitted_at<NOW()-($1::text||' days')::interval))`,[retentionDays]);
      return{expired:expired.rowCount??0,archived:archived.rowCount??0,
        suspicious:(suspiciousVisitors.rowCount??0)+(suspiciousActivity.rowCount??0)};
    });
    if(result.expired||result.archived||result.suspicious)this.logger.log(`Cart maintenance: ${JSON.stringify(result)}`);
    return result;
  }
}
