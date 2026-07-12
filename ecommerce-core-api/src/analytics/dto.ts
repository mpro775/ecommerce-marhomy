import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
export const CATALOG_EVENTS=['product_viewed','category_viewed','brand_viewed','quote_cart_created','quote_item_added',
  'quote_item_updated','quote_item_removed','quote_form_started','quote_request_submitted','quote_request_status_changed','quote_request_assigned'] as const;
export class TrackCatalogEventDto{
  @IsIn(CATALOG_EVENTS)eventName!:typeof CATALOG_EVENTS[number];
  @IsOptional()@IsString()@MaxLength(100)anonymousId?:string;
  @IsOptional()@IsString()@MaxLength(100)sessionId?:string;
  @IsOptional()@IsUUID()productId?:string;
  @IsOptional()@IsUUID()categoryId?:string;
  @IsOptional()@IsUUID()brandId?:string;
  @IsOptional()@IsString()@MaxLength(50)source?:string;
  @IsOptional()@IsObject()metadata?:Record<string,unknown>;
}
