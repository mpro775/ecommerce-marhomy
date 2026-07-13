import { BadRequestException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { assertQuoteQuantity, sanitizeText } from '../common/domain/quote-rules';
import { DatabaseService, DbExecutor } from '../database/database.service';
import type { AddQuoteCartItemDto, CreateQuoteCartDto, UpdateQuoteCartItemDto } from './dto';

interface ModelRuleRow {id:string;product_id:string;unit_of_measure:string;minimum_request_quantity:string;maximum_request_quantity:string|null;
  quantity_step:string;quote_enabled:boolean;availability_status:string;is_active:boolean;product_status:string;product_quote_enabled:boolean}
export interface CartRow {id:string;public_token:string;status:string;expires_at:Date|null;archived_at:Date|null}

@Injectable()
export class QuoteCartsService {
  constructor(private readonly database:DatabaseService,private readonly config:ConfigService){}
  async create(input:CreateQuoteCartDto):Promise<unknown>{const token=randomBytes(32).toString('base64url');const days=this.config.get<number>('QUOTE_CART_TTL_DAYS',14);
    const result=await this.database.query(`INSERT INTO quote_carts(public_token,visitor_id,expires_at) VALUES($1,$2,NOW()+($3::text||' days')::interval) RETURNING *`,[token,input.visitorId??null,days]);
    await this.event('quote_cart_created',{quoteCartId:result.rows[0].id});return result.rows[0];}
  async get(token:string,db:DbExecutor=this.database,lock=false):Promise<{cart:CartRow;items:unknown[]}>{if(!token)throw new BadRequestException('Quote cart token is required');
    const result=await db.query(`SELECT * FROM quote_carts WHERE public_token=$1${lock?' FOR UPDATE':''}`,[token]);const cart=result.rows[0] as CartRow|undefined;if(!cart)throw new NotFoundException('Quote cart not found');
    if(cart.archived_at)throw new GoneException('Quote cart has been archived');if(cart.status==='open'&&cart.expires_at&&new Date(cart.expires_at).getTime()<=Date.now()){
      await db.query(`UPDATE quote_carts SET status='expired',updated_at=NOW() WHERE id=$1`,[cart.id]);throw new GoneException('Quote cart has expired');}
    const items=await db.query(`SELECT i.*,p.title_ar,p.title_en,p.slug,m.model_code,m.title_ar AS model_title_ar,m.title_en AS model_title_en,m.sku,m.availability_status,
      COALESCE((SELECT image_url FROM product_model_images WHERE model_id=m.id ORDER BY is_primary DESC,sort_order LIMIT 1),
        (SELECT image_url FROM product_images WHERE product_id=p.id ORDER BY is_primary DESC,sort_order LIMIT 1)) AS image_url
      FROM quote_cart_items i JOIN products p ON p.id=i.product_id JOIN product_models m ON m.id=i.model_id
      WHERE i.quote_cart_id=$1 ORDER BY i.sort_order,i.created_at`,[cart.id]);return{cart,items:items.rows};}
  async add(token:string,input:AddQuoteCartItemDto):Promise<unknown>{return this.database.transaction(async client=>{const{cart}=await this.get(token,client,true);this.assertOpen(cart);
    const model=await this.modelRules(client,input.productId,input.modelId);this.validateQuantity(model,input.quantity);
    const existing=await client.query<{id:string;quantity:string}>('SELECT id,quantity FROM quote_cart_items WHERE quote_cart_id=$1 AND model_id=$2',[cart.id,input.modelId]);let item;
    if(existing.rows[0]){const quantity=Number(existing.rows[0].quantity)+input.quantity;this.validateQuantity(model,quantity);item=(await client.query(`UPDATE quote_cart_items SET quantity=$2,item_note=COALESCE($3,item_note),updated_at=NOW() WHERE id=$1 RETURNING *`,
      [existing.rows[0].id,quantity,sanitizeText(input.itemNote,1000)])).rows[0];}else item=(await client.query(`INSERT INTO quote_cart_items(quote_cart_id,product_id,model_id,quantity,unit_snapshot,item_note)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[cart.id,input.productId,input.modelId,input.quantity,model.unit_of_measure,sanitizeText(input.itemNote,1000)])).rows[0];
    await this.event('model_added_to_quote',{quoteCartId:cart.id,productId:input.productId,modelId:input.modelId,quantity:input.quantity},client);return item;});}
  async update(token:string,itemId:string,input:UpdateQuoteCartItemDto):Promise<unknown>{return this.database.transaction(async client=>{const{cart}=await this.get(token,client,true);this.assertOpen(cart);
    const item=await client.query<{product_id:string;model_id:string}>('SELECT product_id,model_id FROM quote_cart_items WHERE id=$1 AND quote_cart_id=$2',[itemId,cart.id]);if(!item.rows[0])throw new NotFoundException('Quote cart item not found');
    const model=await this.modelRules(client,item.rows[0].product_id,item.rows[0].model_id);this.validateQuantity(model,input.quantity);return(await client.query(`UPDATE quote_cart_items SET quantity=$2,item_note=COALESCE($3,item_note),updated_at=NOW() WHERE id=$1 RETURNING *`,
      [itemId,input.quantity,sanitizeText(input.itemNote,1000)])).rows[0];});}
  async remove(token:string,itemId:string):Promise<void>{await this.database.transaction(async client=>{const{cart}=await this.get(token,client,true);this.assertOpen(cart);const result=await client.query('DELETE FROM quote_cart_items WHERE id=$1 AND quote_cart_id=$2 RETURNING product_id,model_id',[itemId,cart.id]);
    if(!result.rowCount)throw new NotFoundException('Quote cart item not found');await this.event('quote_item_removed',{quoteCartId:cart.id,productId:result.rows[0].product_id,modelId:result.rows[0].model_id},client);});}
  async clear(token:string):Promise<void>{await this.database.transaction(async client=>{const{cart}=await this.get(token,client,true);this.assertOpen(cart);await client.query('DELETE FROM quote_cart_items WHERE quote_cart_id=$1',[cart.id]);});}
  private async modelRules(db:DbExecutor,productId:string,modelId:string):Promise<ModelRuleRow>{const result=await db.query<ModelRuleRow>(`SELECT m.id,m.product_id,m.unit_of_measure,m.minimum_request_quantity,m.maximum_request_quantity,m.quantity_step,m.quote_enabled,
    m.availability_status,m.is_active,p.status AS product_status,p.quote_enabled AS product_quote_enabled FROM product_models m JOIN products p ON p.id=m.product_id WHERE m.id=$1 AND m.product_id=$2`,[modelId,productId]);
    const model=result.rows[0];if(!model)throw new BadRequestException('Model does not belong to this product');if(model.product_status!=='published'||!model.product_quote_enabled||!model.is_active||!model.quote_enabled||['hidden','discontinued'].includes(model.availability_status))
      throw new BadRequestException('Model is not available for quote requests');return model;}
  private validateQuantity(model:ModelRuleRow,quantity:number):void{assertQuoteQuantity(quantity,Number(model.minimum_request_quantity),model.maximum_request_quantity===null?null:Number(model.maximum_request_quantity),Number(model.quantity_step));}
  private assertOpen(cart:CartRow):void{if(cart.status!=='open')throw new BadRequestException('Quote cart is not open');}
  private async event(name:string,data:Record<string,unknown>,db:DbExecutor=this.database):Promise<void>{await db.query(`INSERT INTO catalog_events(event_name,quote_cart_id,product_id,model_id,metadata) VALUES($1,$2,$3,$4,$5)`,
    [name,data.quoteCartId??null,data.productId??null,data.modelId??null,data]);}
}
