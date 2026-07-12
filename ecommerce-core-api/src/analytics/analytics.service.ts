import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { TrackCatalogEventDto } from './dto';
@Injectable()
export class AnalyticsService{
  constructor(private readonly database:DatabaseService){}
  async track(input:TrackCatalogEventDto):Promise<void>{
    const metadata=JSON.stringify(input.metadata??{});if(Buffer.byteLength(metadata)>10000)return;
    await this.database.query(`INSERT INTO catalog_events(event_name,anonymous_id,session_id,product_id,category_id,brand_id,source,metadata)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[input.eventName,input.anonymousId??null,input.sessionId??null,input.productId??null,
      input.categoryId??null,input.brandId??null,input.source??'web',input.metadata??{}]);
  }
  async dashboard():Promise<Record<string,unknown>>{
    const [status,contacts,carts,requests,averages,products,categories,brands,cities,sources,agents]=await Promise.all([
      this.database.query(`SELECT status,COUNT(*)::int AS count FROM quote_requests GROUP BY status`),
      this.database.query(`SELECT COUNT(*)::int AS count FROM contacts`),
      this.database.query(`SELECT COUNT(*)::int AS carts,COUNT(*) FILTER(WHERE status='submitted')::int AS submitted FROM quote_carts`),
      this.database.query(`SELECT COUNT(*)::int AS count FROM quote_requests`),
      this.database.query(`SELECT COALESCE(AVG(item_count),0)::numeric(12,2) AS average_items,
        COALESCE(AVG(EXTRACT(EPOCH FROM(first_reviewed_at-submitted_at))/60) FILTER(WHERE first_reviewed_at IS NOT NULL),0)::numeric(12,2) AS average_first_review_minutes,
        COALESCE(AVG(EXTRACT(EPOCH FROM(last_contacted_at-submitted_at))/60) FILTER(WHERE last_contacted_at IS NOT NULL),0)::numeric(12,2) AS average_first_contact_minutes
        FROM quote_requests q LEFT JOIN LATERAL(SELECT COUNT(*) AS item_count FROM quote_request_items WHERE quote_request_id=q.id)i ON TRUE`),
      this.database.query(`SELECT i.product_title_snapshot AS label,COUNT(*)::int AS request_count,SUM(i.quantity)::numeric(14,3) AS requested_quantity
        FROM quote_request_items i GROUP BY i.product_title_snapshot ORDER BY request_count DESC LIMIT 10`),
      this.database.query(`SELECT c.title_ar AS label,COUNT(*)::int AS request_count FROM quote_request_items i
        JOIN products p ON p.id=i.product_id JOIN categories c ON c.id=p.category_id GROUP BY c.id ORDER BY request_count DESC LIMIT 10`),
      this.database.query(`SELECT b.title_ar AS label,COUNT(*)::int AS request_count FROM quote_request_items i
        JOIN products p ON p.id=i.product_id JOIN brands b ON b.id=p.brand_id GROUP BY b.id ORDER BY request_count DESC LIMIT 10`),
      this.database.query(`SELECT COALESCE(city,'Unknown') AS label,COUNT(*)::int AS request_count FROM quote_requests GROUP BY city ORDER BY request_count DESC LIMIT 10`),
      this.database.query(`SELECT source AS label,COUNT(*)::int AS request_count FROM quote_requests GROUP BY source ORDER BY request_count DESC`),
      this.database.query(`SELECT COALESCE(u.full_name,'Unassigned') AS label,COUNT(*)::int AS request_count FROM quote_requests q
        LEFT JOIN admin_users u ON u.id=q.assigned_to_admin_user_id GROUP BY u.id,u.full_name ORDER BY request_count DESC`),
    ]);
    const cartCount=Number(carts.rows[0]?.carts??0),submitted=Number(carts.rows[0]?.submitted??0);
    return{statusCounts:status.rows,contactCount:contacts.rows[0]?.count??0,requestCount:requests.rows[0]?.count??0,
      cartConversionRate:cartCount?Number(((submitted/cartCount)*100).toFixed(2)):0,averages:averages.rows[0],
      topProducts:products.rows,topCategories:categories.rows,topBrands:brands.rows,byCity:cities.rows,bySource:sources.rows,byAgent:agents.rows};
  }
}
