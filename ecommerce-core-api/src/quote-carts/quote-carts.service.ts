import { GoneException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { DatabaseService, DbExecutor } from '../database/database.service';
import { assertQuoteQuantity, sanitizeText } from '../common/domain/quote-rules';
import type { AddQuoteCartItemDto, CreateQuoteCartDto, UpdateQuoteCartItemDto } from './dto';
interface ProductRuleRow{id:string;unit_of_measure:string;minimum_request_quantity:string;maximum_request_quantity:string|null;
  quantity_step:string;quote_enabled:boolean;availability_status:string;status:string}
export interface CartRow{id:string;public_token:string;status:string;expires_at:Date|null}
@Injectable()
export class QuoteCartsService{
  constructor(private readonly database:DatabaseService,private readonly config:ConfigService){}
  async create(input:CreateQuoteCartDto):Promise<unknown>{
    const token=randomBytes(32).toString('base64url');const days=this.config.get<number>('QUOTE_CART_TTL_DAYS',14);
    const result=await this.database.query(`INSERT INTO quote_carts(public_token,visitor_id,expires_at)
      VALUES($1,$2,NOW()+($3::text||' days')::interval) RETURNING *`,[token,input.visitorId??null,days]);
    await this.event('quote_cart_created',{quoteCartId:result.rows[0].id});return result.rows[0];
  }
  async get(token:string,executor?:DbExecutor,lock=false):Promise<{cart:CartRow;items:unknown[]}>{
    const db=executor??this.database;const result=await db.query(`SELECT * FROM quote_carts WHERE public_token=$1`+(lock?' FOR UPDATE':''),[token]);
    const cart=result.rows[0] as CartRow|undefined;if(!cart)throw new NotFoundException('Quote cart not found');
    if(cart.status==='open'&&cart.expires_at&&new Date(cart.expires_at).getTime()<=Date.now()){
      await db.query(`UPDATE quote_carts SET status='expired',updated_at=NOW() WHERE id=$1`,[cart.id]);throw new GoneException('Quote cart has expired');
    }
    const items=await db.query(`SELECT i.*,p.title_ar,p.title_en,p.slug,p.availability_status,p.quote_enabled,
      v.title_ar AS variant_title_ar,v.title_en AS variant_title_en,v.attributes AS variant_attributes,
      (SELECT image_url FROM product_images WHERE product_id=p.id ORDER BY is_primary DESC,sort_order LIMIT 1) AS image_url
      FROM quote_cart_items i JOIN products p ON p.id=i.product_id LEFT JOIN product_variants v ON v.id=i.variant_id
      WHERE i.quote_cart_id=$1 ORDER BY i.created_at`,[cart.id]);
    return{cart,items:items.rows};
  }
  async add(token:string,input:AddQuoteCartItemDto):Promise<unknown>{
    return this.database.transaction(async(client)=>{
      const {cart}=await this.get(token,client,true);this.assertOpen(cart);
      const product=await this.productRules(client,input.productId);await this.assertSelectableVariant(client,product.id,input.variantId);
      this.validateQuantity(product,input.quantity);
      const selected=input.selectedOptions??{};const existing=await client.query<{id:string;quantity:string}>(`SELECT id,quantity FROM quote_cart_items
        WHERE quote_cart_id=$1 AND product_id=$2 AND variant_id IS NOT DISTINCT FROM $3 AND selected_options=$4::jsonb`,
        [cart.id,input.productId,input.variantId??null,selected]);
      let item;
      if(existing.rows[0]){
        const quantity=Number(existing.rows[0].quantity)+input.quantity;this.validateQuantity(product,quantity);
        item=(await client.query(`UPDATE quote_cart_items SET quantity=$2,item_note=COALESCE($3,item_note),updated_at=NOW()
          WHERE id=$1 RETURNING *`,[existing.rows[0].id,quantity,sanitizeText(input.itemNote,1000)])).rows[0];
      }else item=(await client.query(`INSERT INTO quote_cart_items(quote_cart_id,product_id,variant_id,quantity,unit_snapshot,selected_options,item_note)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[cart.id,input.productId,input.variantId??null,input.quantity,product.unit_of_measure,
        selected,sanitizeText(input.itemNote,1000)])).rows[0];
      await this.event('quote_item_added',{quoteCartId:cart.id,productId:product.id,quantity:input.quantity},client);return item;
    });
  }
  async update(token:string,itemId:string,input:UpdateQuoteCartItemDto):Promise<unknown>{
    return this.database.transaction(async(client)=>{
      const {cart}=await this.get(token,client,true);this.assertOpen(cart);
      const item=await client.query<{id:string;product_id:string}>('SELECT id,product_id FROM quote_cart_items WHERE id=$1 AND quote_cart_id=$2',[itemId,cart.id]);
      if(!item.rows[0])throw new NotFoundException('Quote cart item not found');
      const product=await this.productRules(client,item.rows[0].product_id);this.validateQuantity(product,input.quantity);
      const updated=await client.query(`UPDATE quote_cart_items SET quantity=$2,item_note=COALESCE($3,item_note),updated_at=NOW()
        WHERE id=$1 RETURNING *`,[itemId,input.quantity,sanitizeText(input.itemNote,1000)]);
      await this.event('quote_item_updated',{quoteCartId:cart.id,productId:product.id,quantity:input.quantity},client);return updated.rows[0];
    });
  }
  async remove(token:string,itemId:string):Promise<void>{
    await this.database.transaction(async(client)=>{const{cart}=await this.get(token,client,true);this.assertOpen(cart);
      const result=await client.query('DELETE FROM quote_cart_items WHERE id=$1 AND quote_cart_id=$2 RETURNING product_id',[itemId,cart.id]);
      if(!result.rowCount)throw new NotFoundException('Quote cart item not found');
      await this.event('quote_item_removed',{quoteCartId:cart.id,productId:result.rows[0].product_id},client);});
  }
  async clear(token:string):Promise<void>{await this.database.transaction(async(client)=>{const{cart}=await this.get(token,client,true);this.assertOpen(cart);
    await client.query('DELETE FROM quote_cart_items WHERE quote_cart_id=$1',[cart.id]);});}
  private async productRules(db:DbExecutor,id:string):Promise<ProductRuleRow>{
    const result=await db.query<ProductRuleRow>('SELECT id,unit_of_measure,minimum_request_quantity,maximum_request_quantity,quantity_step,quote_enabled,availability_status,status FROM products WHERE id=$1',[id]);
    const product=result.rows[0];if(!product)throw new NotFoundException('Product not found');
    if(product.status!=='published'||!product.quote_enabled||['temporarily_unavailable','discontinued'].includes(product.availability_status))
      throw new BadRequestException('Product is not available for quote requests');return product;
  }
  private async assertSelectableVariant(db:DbExecutor,productId:string,variantId?:string):Promise<void>{
    if(!variantId)return;const result=await db.query('SELECT id FROM product_variants WHERE id=$1 AND product_id=$2 AND is_active=TRUE',[variantId,productId]);
    if(!result.rows[0])throw new BadRequestException('Variant is not active for this product');
  }
  private validateQuantity(product:ProductRuleRow,quantity:number):void{assertQuoteQuantity(quantity,Number(product.minimum_request_quantity),
    product.maximum_request_quantity===null?null:Number(product.maximum_request_quantity),Number(product.quantity_step));}
  private assertOpen(cart:CartRow):void{if(cart.status!=='open')throw new BadRequestException('Quote cart is not open');}
  private async event(name:string,data:Record<string,unknown>,db:DbExecutor=this.database):Promise<void>{
    await db.query(`INSERT INTO catalog_events(event_name,quote_cart_id,product_id,metadata)
      VALUES($1,$2,$3,$4)`,[name,data.quoteCartId??null,data.productId??null,data]);
  }
}
