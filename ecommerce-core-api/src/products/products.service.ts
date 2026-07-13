import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DatabaseService, DbExecutor } from '../database/database.service';
import { CreateProductDto } from './dto';
import type { ListProductsQuery, ProductFilterRangeDto, ProductImageDto, ProductVariantDto, UpdateProductDto } from './dto';
import * as ExcelJS from 'exceljs';
interface ProductIdRow{id:string}
@Injectable()
export class ProductsService{
  constructor(private readonly database:DatabaseService){}
  async publicList(query:ListProductsQuery):Promise<{items:unknown[];count:number;page:number;pageSize:number}>{
    const page=query.page??1,pageSize=query.pageSize??24,values:unknown[]=[];const where=[`p.status='published'`];
    if(query.search){values.push('%'+query.search+'%');where.push('(p.title_ar ILIKE $'+values.length+' OR p.title_en ILIKE $'+values.length+' OR p.model_code ILIKE $'+values.length+')');}
    if(query.category){values.push(query.category);where.push('(c.slug=$'+values.length+' OR EXISTS(SELECT 1 FROM product_categories pc JOIN categories ec ON ec.id=pc.category_id WHERE pc.product_id=p.id AND ec.slug=$'+values.length+'))');}
    if(query.brand){values.push(query.brand);where.push('b.slug=$'+values.length);}
    if(query.featured!==undefined){values.push(query.featured);where.push('p.is_featured=$'+values.length);}
    const selectedFilters=(query.filterValues??'').split(',').filter(Boolean);
    if(selectedFilters.length){values.push(selectedFilters);const filterIndex=values.length;values.push(selectedFilters.length);
      where.push('p.id IN (SELECT product_id FROM product_filter_values WHERE filter_value_id=ANY($'+filterIndex+
        '::uuid[]) GROUP BY product_id HAVING COUNT(DISTINCT filter_value_id)=$'+values.length+')');}
    const clause=where.join(' AND ');
    const countResult=await this.database.query<{count:string}>(`SELECT COUNT(DISTINCT p.id)::text AS count FROM products p
      LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id WHERE `+clause,values);
    values.push(pageSize,(page-1)*pageSize);
    const result=await this.database.query(`SELECT p.*,c.title_ar AS category_title_ar,c.title_en AS category_title_en,c.slug AS category_slug,
      b.title_ar AS brand_title_ar,b.title_en AS brand_title_en,b.slug AS brand_slug,
      (SELECT image_url FROM product_images WHERE product_id=p.id ORDER BY is_primary DESC,sort_order LIMIT 1) AS primary_image_url,
      (SELECT COUNT(*)::int FROM product_variants WHERE product_id=p.id AND is_active=TRUE) AS active_variant_count,
      (SELECT id FROM product_variants WHERE product_id=p.id AND is_active=TRUE AND is_default=TRUE LIMIT 1) AS active_default_variant_id
      FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id
      WHERE `+clause+' ORDER BY p.is_featured DESC,p.sort_order,p.created_at DESC LIMIT $'+(values.length-1)+' OFFSET $'+values.length,values);
    return{items:result.rows,count:Number(countResult.rows[0]?.count??0),page,pageSize};
  }
  async publicBySlug(slug:string):Promise<unknown>{
    const product=await this.findOne('p.slug=$1 AND p.status='+`'published'`,[slug]);if(!product)throw new NotFoundException('Product not found');return product;
  }
  async adminList(query:ListProductsQuery):Promise<{items:unknown[];count:number;page:number;pageSize:number}>{
    const page=query.page??1,pageSize=query.pageSize??50,term='%'+(query.search??'')+'%';
    const countResult=await this.database.query<{count:string}>(`SELECT COUNT(*)::text AS count FROM products
      WHERE ($1='' OR title_ar ILIKE $2 OR title_en ILIKE $2 OR sku ILIKE $2)`,[query.search??'',term]);
    const result=await this.database.query(`SELECT p.*,(SELECT image_url FROM product_images WHERE product_id=p.id ORDER BY is_primary DESC,sort_order LIMIT 1) AS primary_image_url
      FROM products p WHERE ($1='' OR p.title_ar ILIKE $2 OR p.title_en ILIKE $2 OR p.sku ILIKE $2)
      ORDER BY p.updated_at DESC LIMIT $3 OFFSET $4`,[query.search??'',term,pageSize,(page-1)*pageSize]);
    return{items:result.rows,count:Number(countResult.rows[0]?.count??0),page,pageSize};
  }
  async adminById(id:string):Promise<unknown>{const product=await this.findOne('p.id=$1',[id]);if(!product)throw new NotFoundException('Product not found');return product;}
  async create(input:CreateProductDto):Promise<unknown>{
    return this.database.transaction((client)=>this.createWithExecutor(client,input));
  }
  async update(id:string,input:UpdateProductDto):Promise<unknown>{
    return this.database.transaction(async(client)=>{
      const current=await client.query('SELECT * FROM products WHERE id=$1',[id]);if(!current.rows[0])throw new NotFoundException('Product not found');
      const merged=this.fromRow(current.rows[0] as Record<string,unknown>,input);
      if(input.images!==undefined)merged.images=input.images;if(input.variants!==undefined)merged.variants=input.variants;
      this.validateDto(merged);this.validate(merged);
      await client.query(`UPDATE products SET category_id=$2,brand_id=$3,title_ar=$4,title_en=$5,slug=$6,short_description_ar=$7,
        short_description_en=$8,detailed_description_ar=$9,detailed_description_en=$10,model_code=$11,sku=$12,barcode=$13,youtube_url=$14,
        tags=$15,is_featured=$16,status=$17,published_at=CASE WHEN $17='published' THEN COALESCE(published_at,NOW()) ELSE published_at END,
        sort_order=$18,seo_title_ar=$19,seo_title_en=$20,seo_description_ar=$21,seo_description_en=$22,quote_enabled=$23,
        availability_status=$24,unit_of_measure=$25,minimum_request_quantity=$26,maximum_request_quantity=$27,quantity_step=$28,
        specifications=$29,updated_at=NOW() WHERE id=$1`,[id,...this.values(merged)]);
      if(input.images)await this.replaceImages(client,id,input.images);
      if(input.variants)await this.replaceVariants(client,id,input.variants);
      if(input.relatedProductIds)await this.replaceRelated(client,id,input.relatedProductIds);
      if(input.extraCategoryIds||input.filterValueIds||input.filterRanges)await this.replaceMappings(client,id,input.extraCategoryIds??null,
        input.filterValueIds??null,input.filterRanges??null);
      return this.requireOne(client,id);
    });
  }
  async remove(id:string):Promise<void>{
    const inCarts=await this.database.query('SELECT 1 FROM quote_cart_items WHERE product_id=$1 LIMIT 1',[id]);
    const inRequests=await this.database.query('SELECT 1 FROM quote_request_items WHERE product_id=$1 LIMIT 1',[id]);
    if((inCarts.rowCount??0)>0||(inRequests.rowCount??0)>0){
      const result=await this.database.query(`UPDATE products SET status='archived',quote_enabled=false,updated_at=NOW() WHERE id=$1`,[id]);
      if(!result.rowCount)throw new NotFoundException('Product not found');
    }else{
      const result=await this.database.query('DELETE FROM products WHERE id=$1',[id]);
      if(!result.rowCount)throw new NotFoundException('Product not found');
    }
  }
  async related(id:string):Promise<unknown[]>{return(await this.database.query(`SELECT p.*,
    (SELECT image_url FROM product_images WHERE product_id=p.id ORDER BY is_primary DESC,sort_order LIMIT 1) AS primary_image_url
    FROM product_related_products r JOIN products p ON p.id=r.related_product_id
    WHERE r.product_id=$1 AND p.status='published' ORDER BY r.sort_order`,[id])).rows;}
  async exportWorkbook():Promise<Buffer>{
    const rows=(await this.database.query(`SELECT p.title_ar,p.title_en,p.slug,c.slug AS category_slug,b.slug AS brand_slug,p.short_description_ar,
      p.short_description_en,p.detailed_description_ar,p.detailed_description_en,p.model_code,p.sku,p.barcode,p.youtube_url,p.tags,p.is_featured,
      p.status,p.sort_order,p.seo_title_ar,p.seo_title_en,p.seo_description_ar,p.seo_description_en,p.quote_enabled,p.availability_status,
      p.unit_of_measure,p.minimum_request_quantity,p.maximum_request_quantity,p.quantity_step,p.specifications,
      COALESCE((SELECT json_agg(json_build_object('mediaAssetId',i.media_asset_id,'imageUrl',i.image_url,'altTextAr',i.alt_text_ar,
        'altTextEn',i.alt_text_en,'isPrimary',i.is_primary,'sortOrder',i.sort_order) ORDER BY i.sort_order) FROM product_images i WHERE i.product_id=p.id),'[]') AS images,
      COALESCE((SELECT json_agg(json_build_object('titleAr',v.title_ar,'titleEn',v.title_en,'sku',v.sku,'barcode',v.barcode,
        'attributes',v.attributes,'isDefault',v.is_default,'isActive',v.is_active,'sortOrder',v.sort_order) ORDER BY v.sort_order)
        FROM product_variants v WHERE v.product_id=p.id),'[]') AS variants,
      COALESCE((SELECT string_agg(ec.slug,',') FROM product_categories pc JOIN categories ec ON ec.id=pc.category_id WHERE pc.product_id=p.id),'') AS extra_category_slugs,
      COALESCE((SELECT string_agg(rp.slug,',' ORDER BY pr.sort_order) FROM product_related_products pr JOIN products rp ON rp.id=pr.related_product_id WHERE pr.product_id=p.id),'') AS related_product_slugs,
      COALESCE((SELECT string_agg(pfv.filter_value_id::text,',') FROM product_filter_values pfv WHERE pfv.product_id=p.id),'') AS filter_value_ids,
      COALESCE((SELECT json_agg(json_build_object('filterId',pfr.filter_id,'value',pfr.range_value)) FROM product_filter_ranges pfr WHERE pfr.product_id=p.id),'[]') AS filter_ranges
      FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id ORDER BY p.created_at`)).rows;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Products');
    if (rows.length > 0) {
      sheet.columns = Object.keys(rows[0] as object).map(key => ({ header: key, key }));
      sheet.addRows(rows.map((row:Record<string,unknown>)=>Object.fromEntries(Object.entries(row).map(([key,value])=>
        [key,['specifications','images','variants','filter_ranges'].includes(key)&&typeof value!=='string'?JSON.stringify(value):value]))));
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
  async importWorkbook(buffer:Buffer):Promise<{imported:number;errors:Array<{row:number;field?:string;message:string}>}>{
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    const rows: Array<{rowNumber:number;data:Record<string,unknown>}> = [];
    if (sheet) {
      const headers = sheet.getRow(1).values as string[];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowData: Record<string,unknown> = {};
        (row.values as any[]).forEach((val, colNumber) => {
           if (headers[colNumber]) rowData[headers[colNumber]] = val;
        });
        if(Object.values(rowData).some(value=>value!==null&&value!==undefined&&String(value).trim()!==''))rows.push({rowNumber,data:rowData});
      });
    }
    const errors:Array<{row:number;field?:string;message:string}>=[];const parsed:Array<{rowNumber:number;input:CreateProductDto}>=[];
    for(const item of rows){try{parsed.push({rowNumber:item.rowNumber,input:await this.parseImportRow(item.data,item.rowNumber)});}
      catch(error){errors.push({row:item.rowNumber,message:error instanceof Error?error.message:'Invalid row'});}}
    if(errors.length)return{imported:0,errors};
    try{await this.database.transaction(async client=>{for(const item of parsed){try{await this.createWithExecutor(client,item.input);}
      catch(error){throw new Error(`Row ${item.rowNumber}: ${error instanceof Error?error.message:'could not be imported'}`);}}});}
    catch(error){const message=error instanceof Error?error.message:'Import transaction failed';const match=/Row (\d+):\s*(.*)/s.exec(message);
      return{imported:0,errors:[{row:match?Number(match[1]):0,message:match?.[2]??message}]};}
    return{imported:parsed.length,errors:[]};
  }
  private async findOne(where:string,values:unknown[]):Promise<unknown|null>{
    const result=await this.database.query(`SELECT p.*,c.title_ar AS category_title_ar,c.title_en AS category_title_en,
      b.title_ar AS brand_title_ar,b.title_en AS brand_title_en,
      COALESCE((SELECT json_agg(i ORDER BY i.is_primary DESC,i.sort_order) FROM product_images i WHERE i.product_id=p.id),'[]') AS images,
      COALESCE((SELECT json_agg(vv ORDER BY vv.is_default DESC,vv.sort_order) FROM (SELECT v.*,
        COALESCE((SELECT json_agg(vav.attribute_value_id) FROM variant_attribute_values vav WHERE vav.variant_id=v.id),'[]') AS attribute_value_ids
        FROM product_variants v WHERE v.product_id=p.id) vv),'[]') AS variants,
      COALESCE((SELECT json_agg(pc.category_id) FROM product_categories pc WHERE pc.product_id=p.id),'[]') AS extra_category_ids,
      COALESCE((SELECT json_agg(pr.related_product_id ORDER BY pr.sort_order) FROM product_related_products pr WHERE pr.product_id=p.id),'[]') AS related_product_ids,
      COALESCE((SELECT json_agg(pfv.filter_value_id) FROM product_filter_values pfv WHERE pfv.product_id=p.id),'[]') AS filter_value_ids,
      COALESCE((SELECT json_agg(json_build_object('filterId',pfr.filter_id,'value',pfr.range_value)) FROM product_filter_ranges pfr WHERE pfr.product_id=p.id),'[]') AS filter_ranges
      FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id WHERE `+where+' LIMIT 1',values);
    return result.rows[0]??null;
  }
  private values(input:CreateProductDto):unknown[]{return[input.categoryId??null,input.brandId??null,input.titleAr,input.titleEn??null,input.slug,
    input.shortDescriptionAr??null,input.shortDescriptionEn??null,input.detailedDescriptionAr??null,input.detailedDescriptionEn??null,
    input.modelCode??null,input.sku??null,input.barcode??null,input.youtubeUrl??null,input.tags??[],input.isFeatured??false,input.status??'draft',
    input.sortOrder??0,input.seoTitleAr??null,input.seoTitleEn??null,input.seoDescriptionAr??null,input.seoDescriptionEn??null,
    input.quoteEnabled??true,input.availabilityStatus??'available',input.unitOfMeasure??'piece',input.minimumRequestQuantity??1,
    input.maximumRequestQuantity??null,input.quantityStep??1,input.specifications??{}];}
  private validate(input:CreateProductDto):void{
    const minimum=input.minimumRequestQuantity??1,maximum=input.maximumRequestQuantity??null;
    if(maximum!==null&&maximum<minimum)throw new BadRequestException('Maximum quantity must not be less than minimum quantity');
    if((input.images?.filter((image)=>image.isPrimary).length??0)>1)throw new BadRequestException('Only one primary image is allowed');
    if((input.variants?.filter((variant)=>variant.isDefault).length??0)>1)throw new BadRequestException('Only one default variant is allowed');
  }
  private validateDto(input:CreateProductDto):void{
    const errors=validateSync(plainToInstance(CreateProductDto,input));
    if(errors.length)throw new BadRequestException(errors.flatMap(error=>Object.values(error.constraints??{})));
  }
  private fromRow(row:Record<string,unknown>,input:UpdateProductDto):CreateProductDto{
    const get=(key:keyof UpdateProductDto,column:string)=>input[key]===undefined?row[column]:input[key];
    return{categoryId:get('categoryId','category_id') as string|null|undefined,brandId:get('brandId','brand_id') as string|null|undefined,
      titleAr:get('titleAr','title_ar') as string,titleEn:get('titleEn','title_en') as string|null|undefined,slug:get('slug','slug') as string,
      shortDescriptionAr:get('shortDescriptionAr','short_description_ar') as string|null|undefined,shortDescriptionEn:get('shortDescriptionEn','short_description_en') as string|null|undefined,
      detailedDescriptionAr:get('detailedDescriptionAr','detailed_description_ar') as string|null|undefined,detailedDescriptionEn:get('detailedDescriptionEn','detailed_description_en') as string|null|undefined,
      modelCode:get('modelCode','model_code') as string|null|undefined,sku:get('sku','sku') as string|null|undefined,barcode:get('barcode','barcode') as string|null|undefined,
      youtubeUrl:get('youtubeUrl','youtube_url') as string|null|undefined,tags:get('tags','tags') as string[],isFeatured:get('isFeatured','is_featured') as boolean,
      status:get('status','status') as string,sortOrder:Number(get('sortOrder','sort_order')),seoTitleAr:get('seoTitleAr','seo_title_ar') as string|undefined,
      seoTitleEn:get('seoTitleEn','seo_title_en') as string|undefined,seoDescriptionAr:get('seoDescriptionAr','seo_description_ar') as string|undefined,
      seoDescriptionEn:get('seoDescriptionEn','seo_description_en') as string|undefined,quoteEnabled:get('quoteEnabled','quote_enabled') as boolean,
      availabilityStatus:get('availabilityStatus','availability_status') as string,unitOfMeasure:get('unitOfMeasure','unit_of_measure') as string,
      minimumRequestQuantity:Number(get('minimumRequestQuantity','minimum_request_quantity')),
      maximumRequestQuantity:get('maximumRequestQuantity','maximum_request_quantity')===null?null:Number(get('maximumRequestQuantity','maximum_request_quantity')),
      quantityStep:Number(get('quantityStep','quantity_step')),specifications:get('specifications','specifications') as Record<string,string|number|boolean>};
  }
  private async replaceChildren(client:DbExecutor,id:string,images:ProductImageDto[],variants:ProductVariantDto[],related:string[],
    categories:string[],filterValues:string[],filterRanges:ProductFilterRangeDto[]):Promise<void>{
    await this.replaceImages(client,id,images);await this.replaceVariants(client,id,variants);await this.replaceRelated(client,id,related);
    await this.replaceMappings(client,id,categories,filterValues,filterRanges);
  }
  private async replaceImages(client:DbExecutor,id:string,images:ProductImageDto[]):Promise<void>{
    await client.query('DELETE FROM product_images WHERE product_id=$1',[id]);
    for(const image of images)await client.query(`INSERT INTO product_images(product_id,media_asset_id,image_url,alt_text_ar,alt_text_en,is_primary,sort_order)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,image.mediaAssetId??null,image.imageUrl,image.altTextAr??null,image.altTextEn??null,
        image.isPrimary??false,image.sortOrder??0]);
  }
  private async replaceVariants(client:DbExecutor,id:string,variants:ProductVariantDto[]):Promise<void>{
    const existingResult=await client.query('SELECT id FROM product_variants WHERE product_id=$1',[id]);
    const existingIds=existingResult.rows.map((r:any)=>r.id);
    const incomingIds=variants.map(v=>v.id).filter(Boolean) as string[];
    const toDelete=existingIds.filter(eid=>!incomingIds.includes(eid));
    await client.query('UPDATE product_variants SET is_default = FALSE, updated_at = NOW() WHERE product_id = $1 AND is_default = TRUE', [id]);
    for(const variant of variants){
      const relationalAttributes=variant.attributeValueIds?await this.attributesFromValues(client,variant.attributeValueIds):null;
      const attributes=relationalAttributes??variant.attributes??{};
      let variantId=variant.id;
      if(variant.id&&existingIds.includes(variant.id)){
        await client.query(`UPDATE product_variants SET title_ar=$2,title_en=$3,sku=$4,barcode=$5,attributes=$6,is_default=$7,is_active=$8,sort_order=$9,updated_at=NOW() WHERE id=$1 AND product_id=$10`,
          [variant.id,variant.titleAr,variant.titleEn??null,variant.sku??null,variant.barcode??null,attributes,variant.isDefault??false,variant.isActive??true,variant.sortOrder??0,id]);
      }else{
        const inserted=await client.query<ProductIdRow>(`INSERT INTO product_variants(product_id,title_ar,title_en,sku,barcode,attributes,is_default,is_active,sort_order)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,[id,variant.titleAr,variant.titleEn??null,variant.sku??null,variant.barcode??null,
          attributes,variant.isDefault??false,variant.isActive??true,variant.sortOrder??0]);variantId=inserted.rows[0].id;
      }
      if(variant.attributeValueIds&&variantId){await client.query('DELETE FROM variant_attribute_values WHERE variant_id=$1',[variantId]);
        for(const valueId of variant.attributeValueIds)await client.query(
          'INSERT INTO variant_attribute_values(variant_id,attribute_value_id) VALUES($1,$2)',[variantId,valueId]);}
    }
    if(toDelete.length>0)await client.query(`UPDATE product_variants SET is_active=false,is_default=false,updated_at=NOW() WHERE id=ANY($1) AND product_id=$2`,[toDelete,id]);
  }
  private async replaceRelated(client:DbExecutor,id:string,related:string[]):Promise<void>{
    await client.query('DELETE FROM product_related_products WHERE product_id=$1',[id]);
    for(let index=0;index<related.length;index++)if(related[index]!==id)await client.query(
      'INSERT INTO product_related_products(product_id,related_product_id,sort_order) VALUES($1,$2,$3)',[id,related[index],index]);
  }
  private async replaceMappings(client:DbExecutor,id:string,categories:string[]|null,filterValues:string[]|null,filterRanges:ProductFilterRangeDto[]|null):Promise<void>{
    if(categories){await client.query('DELETE FROM product_categories WHERE product_id=$1',[id]);
      for(const categoryId of categories)await client.query('INSERT INTO product_categories(product_id,category_id) VALUES($1,$2)',[id,categoryId]);}
    if(filterValues){await client.query('DELETE FROM product_filter_values WHERE product_id=$1',[id]);
      for(const valueId of filterValues)await client.query('INSERT INTO product_filter_values(product_id,filter_value_id) VALUES($1,$2)',[id,valueId]);}
    if(filterRanges){await client.query('DELETE FROM product_filter_ranges WHERE product_id=$1',[id]);
      for(const range of filterRanges)await client.query('INSERT INTO product_filter_ranges(product_id,filter_id,range_value) VALUES($1,$2,$3)',
        [id,range.filterId,range.value]);}
  }
  private async requireOne(client:DbExecutor,id:string):Promise<unknown>{const result=await client.query('SELECT * FROM products WHERE id=$1',[id]);return result.rows[0];}
  private async createWithExecutor(client:DbExecutor,input:CreateProductDto):Promise<unknown>{
    this.validateDto(input);this.validate(input);const result=await client.query<ProductIdRow>(`INSERT INTO products(category_id,brand_id,title_ar,title_en,slug,short_description_ar,
      short_description_en,detailed_description_ar,detailed_description_en,model_code,sku,barcode,youtube_url,tags,is_featured,status,
      published_at,sort_order,seo_title_ar,seo_title_en,seo_description_ar,seo_description_en,quote_enabled,availability_status,
      unit_of_measure,minimum_request_quantity,maximum_request_quantity,quantity_step,specifications)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,CASE WHEN $16='published' THEN NOW() ELSE NULL END,
      $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28) RETURNING id`,this.values(input));
    const id=result.rows[0].id;await this.replaceChildren(client,id,input.images??[],input.variants??[],input.relatedProductIds??[],
      input.extraCategoryIds??[],input.filterValueIds??[],input.filterRanges??[]);return this.requireOne(client,id);
  }
  private async attributesFromValues(client:DbExecutor,valueIds:string[]):Promise<Record<string,string>>{
    if(!valueIds.length)return{};const result=await client.query<{name_ar:string;value_ar:string}>(`SELECT a.name_ar,av.value_ar
      FROM attribute_values av JOIN attributes a ON a.id=av.attribute_id WHERE av.id=ANY($1::uuid[])`,[valueIds]);
    if(result.rows.length!==valueIds.length)throw new BadRequestException('One or more attribute values are invalid');
    return Object.fromEntries(result.rows.map(row=>[row.name_ar,row.value_ar]));
  }
  private async parseImportRow(row:Record<string,unknown>,rowNumber:number):Promise<CreateProductDto>{
    const text=(key:string)=>row[key]===null||row[key]===undefined||String(row[key]).trim()===''?undefined:String(row[key]).trim();
    const required=(key:string)=>{const value=text(key);if(!value)throw new Error(`Row ${rowNumber}: ${key} is required`);return value;};
    const bool=(key:string,fallback:boolean)=>{const value=text(key)?.toLowerCase();if(value===undefined)return fallback;
      if(['true','1','yes','y','نعم'].includes(value))return true;if(['false','0','no','n','لا'].includes(value))return false;
      throw new Error(`Row ${rowNumber}: ${key} must be true/false`);};
    const number=(key:string,fallback?:number)=>{const raw=text(key);if(raw===undefined)return fallback;const value=Number(raw);
      if(!Number.isFinite(value))throw new Error(`Row ${rowNumber}: ${key} must be a number`);return value;};
    const json=(key:string,fallback:unknown)=>{const raw=text(key);if(!raw)return fallback;try{return JSON.parse(raw);}catch{throw new Error(`Row ${rowNumber}: ${key} contains invalid JSON`);}};
    const categorySlug=text('category_slug'),brandSlug=text('brand_slug');
    const categoryId=categorySlug?(await this.database.query<{id:string}>('SELECT id FROM categories WHERE slug=$1',[categorySlug])).rows[0]?.id:undefined;
    const brandId=brandSlug?(await this.database.query<{id:string}>('SELECT id FROM brands WHERE slug=$1',[brandSlug])).rows[0]?.id:undefined;
    if(categorySlug&&!categoryId)throw new Error(`Row ${rowNumber}: category_slug was not found`);if(brandSlug&&!brandId)throw new Error(`Row ${rowNumber}: brand_slug was not found`);
    const extraCategorySlugs=text('extra_category_slugs')?.split(',').map(value=>value.trim()).filter(Boolean)??[];
    const relatedProductSlugs=text('related_product_slugs')?.split(',').map(value=>value.trim()).filter(Boolean)??[];
    const extraCategoryIds=await this.resolveImportSlugs('categories',extraCategorySlugs,rowNumber,'extra_category_slugs');
    const relatedProductIds=await this.resolveImportSlugs('products',relatedProductSlugs,rowNumber,'related_product_slugs');
    const filterValueIds=text('filter_value_ids')?.split(',').map(value=>value.trim()).filter(Boolean)??[];
    const status=text('status')??'draft',availabilityStatus=text('availability_status')??'available',unitOfMeasure=text('unit_of_measure')??'piece';
    if(!['draft','published','archived'].includes(status))throw new Error(`Row ${rowNumber}: status is invalid`);
    if(!['available','on_request','temporarily_unavailable','discontinued'].includes(availabilityStatus))throw new Error(`Row ${rowNumber}: availability_status is invalid`);
    if(!['piece','box','carton','meter','kilogram','gram','liter','set','roll','pack'].includes(unitOfMeasure))throw new Error(`Row ${rowNumber}: unit_of_measure is invalid`);
    const tags=text('tags')?.split(',').map(v=>v.trim()).filter(Boolean)??[];
    const input:CreateProductDto={titleAr:required('title_ar'),titleEn:text('title_en'),slug:required('slug'),categoryId,brandId,modelCode:text('model_code'),sku:text('sku'),
      barcode:text('barcode'),youtubeUrl:text('youtube_url'),shortDescriptionAr:text('short_description_ar'),shortDescriptionEn:text('short_description_en'),
      detailedDescriptionAr:text('detailed_description_ar'),detailedDescriptionEn:text('detailed_description_en'),tags,isFeatured:bool('is_featured',false),
      status,quoteEnabled:bool('quote_enabled',true),availabilityStatus,unitOfMeasure,sortOrder:number('sort_order',0),
      minimumRequestQuantity:number('minimum_request_quantity',1),maximumRequestQuantity:number('maximum_request_quantity'),quantityStep:number('quantity_step',1),
      seoTitleAr:text('seo_title_ar'),seoTitleEn:text('seo_title_en'),seoDescriptionAr:text('seo_description_ar'),seoDescriptionEn:text('seo_description_en'),
      specifications:json('specifications',{}) as Record<string,string|number|boolean>,images:json('images',[]) as ProductImageDto[],
      variants:json('variants',[]) as ProductVariantDto[],extraCategoryIds,relatedProductIds,filterValueIds,
      filterRanges:json('filter_ranges',[]) as ProductFilterRangeDto[]};this.validate(input);return input;
  }
  private async resolveImportSlugs(table:'categories'|'products',slugs:string[],rowNumber:number,field:string):Promise<string[]>{
    if(!slugs.length)return[];const result=await this.database.query<{id:string;slug:string}>(`SELECT id,slug FROM ${table} WHERE slug=ANY($1)`,[slugs]);
    const bySlug=new Map(result.rows.map(item=>[item.slug,item.id]));const missing=slugs.filter(slug=>!bySlug.has(slug));
    if(missing.length)throw new Error(`Row ${rowNumber}: ${field} not found: ${missing.join(', ')}`);return slugs.map(slug=>bySlug.get(slug)!);
  }
}
