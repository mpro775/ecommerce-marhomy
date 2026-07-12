import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, DbExecutor } from '../database/database.service';
import type { CreateProductDto, ListProductsQuery, ProductFilterRangeDto, ProductImageDto, ProductVariantDto, UpdateProductDto } from './dto';
import * as XLSX from 'xlsx';
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
      (SELECT image_url FROM product_images WHERE product_id=p.id ORDER BY is_primary DESC,sort_order LIMIT 1) AS primary_image_url
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
    this.validate(input);
    return this.database.transaction(async(client)=>{
      const result=await client.query<ProductIdRow>(`INSERT INTO products(category_id,brand_id,title_ar,title_en,slug,short_description_ar,
        short_description_en,detailed_description_ar,detailed_description_en,model_code,sku,barcode,youtube_url,tags,is_featured,status,
        published_at,sort_order,seo_title_ar,seo_title_en,seo_description_ar,seo_description_en,quote_enabled,availability_status,
        unit_of_measure,minimum_request_quantity,maximum_request_quantity,quantity_step,specifications)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,CASE WHEN $16='published' THEN NOW() ELSE NULL END,
        $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28) RETURNING id`,this.values(input));
      const id=result.rows[0].id;await this.replaceChildren(client,id,input.images??[],input.variants??[],input.relatedProductIds??[],
        input.extraCategoryIds??[],input.filterValueIds??[],input.filterRanges??[]);
      return this.requireOne(client,id);
    });
  }
  async update(id:string,input:UpdateProductDto):Promise<unknown>{
    this.validate(input);return this.database.transaction(async(client)=>{
      const current=await client.query('SELECT * FROM products WHERE id=$1',[id]);if(!current.rows[0])throw new NotFoundException('Product not found');
      const merged=this.fromRow(current.rows[0] as Record<string,unknown>,input);
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
  async remove(id:string):Promise<void>{const result=await this.database.query('DELETE FROM products WHERE id=$1',[id]);if(!result.rowCount)throw new NotFoundException('Product not found');}
  async related(id:string):Promise<unknown[]>{return(await this.database.query(`SELECT p.*,
    (SELECT image_url FROM product_images WHERE product_id=p.id ORDER BY is_primary DESC,sort_order LIMIT 1) AS primary_image_url
    FROM product_related_products r JOIN products p ON p.id=r.related_product_id
    WHERE r.product_id=$1 AND p.status='published' ORDER BY r.sort_order`,[id])).rows;}
  async exportWorkbook():Promise<Buffer>{
    const rows=(await this.database.query(`SELECT title_ar,title_en,slug,model_code,sku,barcode,status,quote_enabled,
      availability_status,unit_of_measure,minimum_request_quantity,maximum_request_quantity,quantity_step,tags,specifications FROM products ORDER BY created_at`)).rows;
    const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(rows),'Products');
    return Buffer.from(XLSX.write(workbook,{type:'buffer',bookType:'xlsx'}));
  }
  async importWorkbook(buffer:Buffer):Promise<{imported:number}>{
    const workbook=XLSX.read(buffer,{type:'buffer'});const sheet=workbook.Sheets[workbook.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet);let imported=0;
    for(const row of rows){
      if(!row.title_ar||!row.slug)continue;
      await this.create({titleAr:String(row.title_ar),titleEn:row.title_en?String(row.title_en):undefined,slug:String(row.slug),
        modelCode:row.model_code?String(row.model_code):undefined,sku:row.sku?String(row.sku):undefined,
        status:['draft','published','archived'].includes(String(row.status))?String(row.status):'draft',
        quoteEnabled:row.quote_enabled!==false,availabilityStatus:String(row.availability_status??'available'),
        unitOfMeasure:String(row.unit_of_measure??'piece'),minimumRequestQuantity:Number(row.minimum_request_quantity??1),
        maximumRequestQuantity:row.maximum_request_quantity?Number(row.maximum_request_quantity):undefined,
        quantityStep:Number(row.quantity_step??1)});imported++;
    }return{imported};
  }
  private async findOne(where:string,values:unknown[]):Promise<unknown|null>{
    const result=await this.database.query(`SELECT p.*,c.title_ar AS category_title_ar,c.title_en AS category_title_en,
      b.title_ar AS brand_title_ar,b.title_en AS brand_title_en,
      COALESCE((SELECT json_agg(i ORDER BY i.is_primary DESC,i.sort_order) FROM product_images i WHERE i.product_id=p.id),'[]') AS images,
      COALESCE((SELECT json_agg(v ORDER BY v.is_default DESC,v.sort_order) FROM product_variants v WHERE v.product_id=p.id),'[]') AS variants
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
  private fromRow(row:Record<string,unknown>,input:UpdateProductDto):CreateProductDto{
    const get=(key:keyof UpdateProductDto,column:string)=>input[key]??row[column];
    return{categoryId:get('categoryId','category_id') as string|undefined,brandId:get('brandId','brand_id') as string|undefined,
      titleAr:get('titleAr','title_ar') as string,titleEn:get('titleEn','title_en') as string|undefined,slug:get('slug','slug') as string,
      shortDescriptionAr:get('shortDescriptionAr','short_description_ar') as string|undefined,shortDescriptionEn:get('shortDescriptionEn','short_description_en') as string|undefined,
      detailedDescriptionAr:get('detailedDescriptionAr','detailed_description_ar') as string|undefined,detailedDescriptionEn:get('detailedDescriptionEn','detailed_description_en') as string|undefined,
      modelCode:get('modelCode','model_code') as string|undefined,sku:get('sku','sku') as string|undefined,barcode:get('barcode','barcode') as string|undefined,
      youtubeUrl:get('youtubeUrl','youtube_url') as string|undefined,tags:get('tags','tags') as string[],isFeatured:get('isFeatured','is_featured') as boolean,
      status:get('status','status') as string,sortOrder:Number(get('sortOrder','sort_order')),seoTitleAr:get('seoTitleAr','seo_title_ar') as string|undefined,
      seoTitleEn:get('seoTitleEn','seo_title_en') as string|undefined,seoDescriptionAr:get('seoDescriptionAr','seo_description_ar') as string|undefined,
      seoDescriptionEn:get('seoDescriptionEn','seo_description_en') as string|undefined,quoteEnabled:get('quoteEnabled','quote_enabled') as boolean,
      availabilityStatus:get('availabilityStatus','availability_status') as string,unitOfMeasure:get('unitOfMeasure','unit_of_measure') as string,
      minimumRequestQuantity:Number(get('minimumRequestQuantity','minimum_request_quantity')),
      maximumRequestQuantity:row.maximum_request_quantity===null&&input.maximumRequestQuantity===undefined?undefined:Number(get('maximumRequestQuantity','maximum_request_quantity')),
      quantityStep:Number(get('quantityStep','quantity_step')),specifications:get('specifications','specifications') as Record<string,string|number|boolean>};
  }
  private async replaceChildren(client:DbExecutor,id:string,images:ProductImageDto[],variants:ProductVariantDto[],related:string[],
    categories:string[],filterValues:string[],filterRanges:ProductFilterRangeDto[]):Promise<void>{
    await this.replaceImages(client,id,images);await this.replaceVariants(client,id,variants);await this.replaceRelated(client,id,related);
    await this.replaceMappings(client,id,categories,filterValues,filterRanges);
  }
  private async replaceImages(client:DbExecutor,id:string,images:ProductImageDto[]):Promise<void>{
    await client.query('DELETE FROM product_images WHERE product_id=$1',[id]);
    for(const image of images)await client.query(`INSERT INTO product_images(product_id,image_url,alt_text_ar,alt_text_en,is_primary,sort_order)
      VALUES($1,$2,$3,$4,$5,$6)`,[id,image.imageUrl,image.altTextAr??null,image.altTextEn??null,image.isPrimary??false,image.sortOrder??0]);
  }
  private async replaceVariants(client:DbExecutor,id:string,variants:ProductVariantDto[]):Promise<void>{
    await client.query('DELETE FROM product_variants WHERE product_id=$1',[id]);
    for(const variant of variants)await client.query(`INSERT INTO product_variants(product_id,title_ar,title_en,sku,barcode,attributes,is_default,is_active,sort_order)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,variant.titleAr,variant.titleEn??null,variant.sku??null,variant.barcode??null,
      variant.attributes??{},variant.isDefault??false,variant.isActive??true,variant.sortOrder??0]);
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
}
