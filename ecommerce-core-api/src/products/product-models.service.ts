import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, DbExecutor } from '../database/database.service';
import type {
  BulkModelStatusDto, CreateProductModelDto, DuplicateModelDto, ModelSpecificationValueDto,
  ProductImageDto, UpdateProductImageDto, UpdateProductModelDto,
} from './dto';

interface IdRow { id: string }

@Injectable()
export class ProductModelsService {
  constructor(private readonly database:DatabaseService){}

  async list(productId:string):Promise<unknown[]>{await this.requireProduct(productId);return(await this.database.query(`SELECT m.*,
    (SELECT image_url FROM product_model_images WHERE model_id=m.id ORDER BY is_primary DESC,sort_order LIMIT 1) AS primary_image_url,
    (SELECT COUNT(*)::int FROM product_model_images WHERE model_id=m.id) AS image_count,
    (SELECT COUNT(*)::int FROM product_model_specification_values WHERE model_id=m.id) AS specification_count
    FROM product_models m WHERE m.product_id=$1 ORDER BY m.is_default DESC,m.sort_order,m.created_at`,[productId])).rows;}

  async one(productId:string,modelId:string):Promise<unknown>{const result=await this.database.query(`SELECT m.*,
    COALESCE((SELECT json_agg(i ORDER BY i.is_primary DESC,i.sort_order) FROM product_model_images i WHERE i.model_id=m.id),'[]') AS images,
    COALESCE((SELECT json_agg(jsonb_build_object('id',sv.id,'specification_id',sv.specification_id,'slug',sd.slug,
      'name_ar',sd.name_ar,'name_en',sd.name_en,'value_type',sd.value_type,'unit_ar',sd.unit_ar,'unit_en',sd.unit_en,
      'value_text_ar',sv.value_text_ar,'value_text_en',sv.value_text_en,'value_number',sv.value_number,
      'value_number_to',sv.value_number_to,'value_boolean',sv.value_boolean,'option_id',sv.option_id,
      'display_value_ar',sv.display_value_ar,'display_value_en',sv.display_value_en,'sort_order',sv.sort_order)
      ORDER BY sv.sort_order,sd.sort_order) FROM product_model_specification_values sv
      JOIN specification_definitions sd ON sd.id=sv.specification_id WHERE sv.model_id=m.id),'[]') AS specifications
    FROM product_models m WHERE m.product_id=$1 AND m.id=$2`,[productId,modelId]);
    if(!result.rows[0])throw new NotFoundException('Product model not found');return result.rows[0];}

  async create(productId:string,input:CreateProductModelDto):Promise<unknown>{this.validateQuantity(input);const id=await this.database.transaction(async client=>{
    await this.requireProduct(productId,client);if(input.isDefault)await client.query('UPDATE product_models SET is_default=FALSE,updated_at=NOW() WHERE product_id=$1',[productId]);
    const result=await client.query<IdRow>(`INSERT INTO product_models(product_id,model_code,title_ar,title_en,short_description_ar,short_description_en,
      description_ar,description_en,sku,barcode,availability_status,quote_enabled,unit_of_measure,minimum_request_quantity,maximum_request_quantity,
      quantity_step,datasheet_url,manual_url,video_url,is_default,is_active,sort_order)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING id`,
      [productId,input.modelCode,input.titleAr??null,input.titleEn??null,input.shortDescriptionAr??null,input.shortDescriptionEn??null,
      input.descriptionAr??null,input.descriptionEn??null,input.sku??null,input.barcode??null,input.availabilityStatus??'available',input.quoteEnabled??true,
      input.unitOfMeasure??'piece',input.minimumRequestQuantity??1,input.maximumRequestQuantity??null,input.quantityStep??1,input.datasheetUrl??null,
      input.manualUrl??null,input.videoUrl??null,input.isDefault??false,input.isActive??true,input.sortOrder??0]);
    if(input.images!==undefined)await this.replaceImages(client,result.rows[0].id,input.images);
    if(input.specifications!==undefined)await this.replaceSpecifications(client,result.rows[0].id,input.specifications);
    return result.rows[0].id;
  });return this.one(productId,id);}

  async update(productId:string,modelId:string,input:UpdateProductModelDto):Promise<unknown>{this.validateQuantity(input);await this.database.transaction(async client=>{
    const current=await this.requireModel(productId,modelId,client);if(input.isDefault===false&&current.is_default)throw new BadRequestException('Set another default model before clearing this one');
    if(input.isDefault===true)await client.query('UPDATE product_models SET is_default=FALSE,updated_at=NOW() WHERE product_id=$1 AND id<>$2',[productId,modelId]);
    const fields:Record<string,string>={modelCode:'model_code',titleAr:'title_ar',titleEn:'title_en',shortDescriptionAr:'short_description_ar',
      shortDescriptionEn:'short_description_en',descriptionAr:'description_ar',descriptionEn:'description_en',sku:'sku',barcode:'barcode',
      availabilityStatus:'availability_status',quoteEnabled:'quote_enabled',unitOfMeasure:'unit_of_measure',minimumRequestQuantity:'minimum_request_quantity',
      maximumRequestQuantity:'maximum_request_quantity',quantityStep:'quantity_step',datasheetUrl:'datasheet_url',manualUrl:'manual_url',videoUrl:'video_url',
      isDefault:'is_default',isActive:'is_active',sortOrder:'sort_order'};
    const record=input as unknown as Record<string,unknown>;const changes=Object.entries(fields).filter(([key])=>record[key]!==undefined);
    if(changes.length){const values=changes.map(([key])=>record[key]);const result=await client.query(`UPDATE product_models SET ${changes.map(([,column],i)=>`${column}=$${i+3}`).join(',')},updated_at=NOW()
      WHERE product_id=$1 AND id=$2 RETURNING id`,[productId,modelId,...values]);if(!result.rowCount)throw new NotFoundException('Product model not found');}
    if(input.images!==undefined)await this.replaceImages(client,modelId,input.images);
    if(input.specifications!==undefined)await this.replaceSpecifications(client,modelId,input.specifications);
    if(!changes.length&&input.images===undefined&&input.specifications===undefined)throw new BadRequestException('No supported fields supplied');
  });return this.one(productId,modelId);}

  async duplicate(productId:string,modelId:string,input:DuplicateModelDto):Promise<unknown>{const id=await this.database.transaction(async client=>{
    await this.requireModel(productId,modelId,client);const result=await client.query<IdRow>(`INSERT INTO product_models(product_id,model_code,title_ar,title_en,
      short_description_ar,short_description_en,description_ar,description_en,sku,barcode,availability_status,quote_enabled,unit_of_measure,
      minimum_request_quantity,maximum_request_quantity,quantity_step,datasheet_url,manual_url,video_url,is_default,is_active,sort_order)
      SELECT product_id,$3,title_ar,title_en,short_description_ar,short_description_en,description_ar,description_en,$4,NULL,availability_status,
      quote_enabled,unit_of_measure,minimum_request_quantity,maximum_request_quantity,quantity_step,datasheet_url,manual_url,video_url,FALSE,is_active,sort_order+1
      FROM product_models WHERE product_id=$1 AND id=$2 RETURNING id`,[productId,modelId,input.modelCode,input.sku??null]);
    const newId=result.rows[0].id;await client.query(`INSERT INTO product_model_specification_values(model_id,specification_id,value_text_ar,value_text_en,
      value_number,value_number_to,value_boolean,option_id,display_value_ar,display_value_en,sort_order)
      SELECT $2,specification_id,value_text_ar,value_text_en,value_number,value_number_to,value_boolean,option_id,display_value_ar,display_value_en,sort_order
      FROM product_model_specification_values WHERE model_id=$1`,[modelId,newId]);
    if(input.copyImages)await client.query(`INSERT INTO product_model_images(model_id,media_asset_id,image_url,alt_text_ar,alt_text_en,is_primary,sort_order)
      SELECT $2,media_asset_id,image_url,alt_text_ar,alt_text_en,is_primary,sort_order FROM product_model_images WHERE model_id=$1`,[modelId,newId]);return newId;
  });return this.one(productId,id);}

  async remove(productId:string,modelId:string):Promise<void>{const result=await this.database.query('DELETE FROM product_models WHERE product_id=$1 AND id=$2',[productId,modelId]);
    if(!result.rowCount)throw new NotFoundException('Product model not found');}
  async setDefault(productId:string,modelId:string):Promise<unknown>{await this.database.transaction(async client=>{const model=await this.requireModel(productId,modelId,client);
    if(!model.is_active)throw new BadRequestException('Inactive model cannot be the default');await client.query('UPDATE product_models SET is_default=FALSE,updated_at=NOW() WHERE product_id=$1',[productId]);
    await client.query('UPDATE product_models SET is_default=TRUE,updated_at=NOW() WHERE id=$1',[modelId]);});return this.one(productId,modelId);}
  async reorder(productId:string,modelIds:string[]):Promise<void>{if(new Set(modelIds).size!==modelIds.length)throw new BadRequestException('Duplicate model IDs');return this.database.transaction(async client=>{
    const found=await client.query<{id:string}>('SELECT id FROM product_models WHERE product_id=$1 AND id=ANY($2::uuid[])',[productId,modelIds]);
    if(found.rows.length!==modelIds.length)throw new BadRequestException('One or more models do not belong to the product');
    for(const [index,id] of modelIds.entries())await client.query('UPDATE product_models SET sort_order=$2,updated_at=NOW() WHERE id=$1',[id,index]);});}
  async bulkStatus(productId:string,input:BulkModelStatusDto):Promise<number>{if(input.isActive===undefined&&input.availabilityStatus===undefined&&input.quoteEnabled===undefined)
    throw new BadRequestException('No status change supplied');const result=await this.database.query(`UPDATE product_models SET
      is_active=COALESCE($3,is_active),availability_status=COALESCE($4,availability_status),quote_enabled=COALESCE($5,quote_enabled),updated_at=NOW()
      WHERE product_id=$1 AND id=ANY($2::uuid[])`,[productId,input.modelIds,input.isActive??null,input.availabilityStatus??null,input.quoteEnabled??null]);
    if(result.rowCount!==input.modelIds.length)throw new BadRequestException('One or more models do not belong to the product');return result.rowCount??0;}

  async addImage(productId:string,modelId:string,input:ProductImageDto):Promise<unknown>{await this.requireModel(productId,modelId);return this.database.transaction(async client=>{
    if(input.isPrimary)await client.query('UPDATE product_model_images SET is_primary=FALSE WHERE model_id=$1',[modelId]);
    return(await client.query(`INSERT INTO product_model_images(model_id,media_asset_id,image_url,alt_text_ar,alt_text_en,is_primary,sort_order)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[modelId,input.mediaAssetId??null,input.imageUrl,input.altTextAr??null,input.altTextEn??null,input.isPrimary??false,input.sortOrder??0])).rows[0];});}
  async updateImage(productId:string,modelId:string,imageId:string,input:UpdateProductImageDto):Promise<unknown>{return this.database.transaction(async client=>{
    await this.requireModel(productId,modelId,client);if(input.isPrimary)await client.query('UPDATE product_model_images SET is_primary=FALSE WHERE model_id=$1',[modelId]);
    const fields:Record<string,string>={mediaAssetId:'media_asset_id',imageUrl:'image_url',altTextAr:'alt_text_ar',altTextEn:'alt_text_en',isPrimary:'is_primary',sortOrder:'sort_order'};
    const record=input as unknown as Record<string,unknown>;const changes=Object.entries(fields).filter(([key])=>record[key]!==undefined);if(!changes.length)throw new BadRequestException('No supported fields supplied');
    const result=await client.query(`UPDATE product_model_images SET ${changes.map(([,column],i)=>`${column}=$${i+4}`).join(',')} WHERE id=$1 AND model_id=$2
      AND EXISTS(SELECT 1 FROM product_models WHERE id=$2 AND product_id=$3) RETURNING *`,[imageId,modelId,productId,...changes.map(([key])=>record[key])]);
    if(!result.rows[0])throw new NotFoundException('Model image not found');return result.rows[0];});}
  async reorderImages(productId:string,modelId:string,imageIds:string[]):Promise<void>{await this.requireModel(productId,modelId);return this.database.transaction(async client=>{
    const found=await client.query('SELECT id FROM product_model_images WHERE model_id=$1 AND id=ANY($2::uuid[])',[modelId,imageIds]);if(found.rows.length!==imageIds.length)throw new BadRequestException('Invalid image order');
    for(const [index,id] of imageIds.entries())await client.query('UPDATE product_model_images SET sort_order=$2 WHERE id=$1',[id,index]);});}
  async removeImage(productId:string,modelId:string,imageId:string):Promise<void>{await this.requireModel(productId,modelId);const result=await this.database.query('DELETE FROM product_model_images WHERE id=$1 AND model_id=$2',[imageId,modelId]);
    if(!result.rowCount)throw new NotFoundException('Model image not found');}
  async specifications(productId:string,modelId:string):Promise<unknown>{return(await this.one(productId,modelId) as Record<string,unknown>).specifications;}
  async putSpecifications(productId:string,modelId:string,values:ModelSpecificationValueDto[]):Promise<unknown>{await this.requireModel(productId,modelId);await this.database.transaction(client=>this.replaceSpecifications(client,modelId,values));return this.specifications(productId,modelId);}

  private validateQuantity(input:Partial<CreateProductModelDto>):void{const min=input.minimumRequestQuantity,max=input.maximumRequestQuantity;if(min!==undefined&&max!==undefined&&max!==null&&max<min)
    throw new BadRequestException('Maximum quantity must not be less than minimum quantity');if((input.images?.filter(image=>image.isPrimary).length??0)>1)throw new BadRequestException('Only one primary image is allowed');}
  private async replaceImages(db:DbExecutor,modelId:string,images:ProductImageDto[]):Promise<void>{if(images.filter(image=>image.isPrimary).length>1)throw new BadRequestException('Only one primary image is allowed');
    await db.query('DELETE FROM product_model_images WHERE model_id=$1',[modelId]);for(const image of images)await db.query(`INSERT INTO product_model_images(model_id,media_asset_id,image_url,alt_text_ar,alt_text_en,is_primary,sort_order)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[modelId,image.mediaAssetId??null,image.imageUrl,image.altTextAr??null,image.altTextEn??null,image.isPrimary??false,image.sortOrder??0]);}
  private async replaceSpecifications(db:DbExecutor,modelId:string,values:ModelSpecificationValueDto[]):Promise<void>{if(new Set(values.map(value=>value.specificationId)).size!==values.length)
    throw new BadRequestException('A specification may only appear once');await db.query('DELETE FROM product_model_specification_values WHERE model_id=$1',[modelId]);
    for(const value of values)await db.query(`INSERT INTO product_model_specification_values(model_id,specification_id,value_text_ar,value_text_en,value_number,
      value_number_to,value_boolean,option_id,display_value_ar,display_value_en,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [modelId,value.specificationId,value.valueTextAr??null,value.valueTextEn??null,value.valueNumber??null,value.valueNumberTo??null,value.valueBoolean??null,
      value.optionId??null,value.displayValueAr??null,value.displayValueEn??null,value.sortOrder??0]);}
  private async requireProduct(productId:string,db:DbExecutor=this.database):Promise<void>{const result=await db.query('SELECT 1 FROM products WHERE id=$1',[productId]);if(!result.rowCount)throw new NotFoundException('Product not found');}
  private async requireModel(productId:string,modelId:string,db:DbExecutor=this.database):Promise<Record<string,unknown>>{const result=await db.query('SELECT * FROM product_models WHERE product_id=$1 AND id=$2',[productId,modelId]);
    if(!result.rows[0])throw new NotFoundException('Product model not found');return result.rows[0];}
}
