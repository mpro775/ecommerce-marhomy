import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, DbExecutor } from '../database/database.service';
import type { CreateProductDto, ListProductsQuery, ProductImageDto, UpdateProductDto } from './dto';

interface ProductIdRow { id: string }
interface PublicFilter { slug: string; min?: number; max?: number; optionKey?: string; text?: string; boolean?: boolean }

@Injectable()
export class ProductsService {
  constructor(private readonly database: DatabaseService) {}

  async publicList(query: ListProductsQuery): Promise<{items: unknown[]; count: number; page: number; pageSize: number}> {
    const page=query.page??1,pageSize=query.pageSize??24,values:unknown[]=[];
    const where=[`p.status='published'`];
    if(query.search){values.push('%'+query.search.trim()+'%');const n=values.length;
      where.push(`(p.title_ar ILIKE $${n} OR p.title_en ILIKE $${n} OR p.description_ar ILIKE $${n} OR p.description_en ILIKE $${n}
        OR b.title_ar ILIKE $${n} OR b.title_en ILIKE $${n} OR EXISTS(SELECT 1 FROM product_models sm WHERE sm.product_id=p.id
        AND sm.is_active AND (sm.model_code ILIKE $${n} OR sm.title_ar ILIKE $${n} OR sm.title_en ILIKE $${n} OR sm.sku ILIKE $${n} OR sm.barcode ILIKE $${n})))`);}
    if(query.category){values.push(query.category);const n=values.length;where.push(`p.id IN (
      WITH RECURSIVE descendants AS (SELECT id FROM categories WHERE slug=$${n} UNION ALL SELECT c.id FROM categories c JOIN descendants d ON c.parent_id=d.id)
      SELECT p2.id FROM products p2 LEFT JOIN product_categories pc2 ON pc2.product_id=p2.id
      WHERE p2.primary_category_id IN (SELECT id FROM descendants) OR pc2.category_id IN (SELECT id FROM descendants))`);}
    if(query.brand){values.push(query.brand);where.push(`b.slug=$${values.length}`);}
    if(query.featured!==undefined){values.push(query.featured);where.push(`p.is_featured=$${values.length}`);}
    const filters=this.parseFilters(query.filters);const modelConditions:string[]=[];
    for(const filter of filters){values.push(filter.slug);const slugIndex=values.length;const conditions=[`sv.model_id=m.id`,`sd.slug=$${slugIndex}`];
      if(filter.min!==undefined){values.push(filter.min);conditions.push(`sv.value_number>=$${values.length}`);}
      if(filter.max!==undefined){values.push(filter.max);conditions.push(`COALESCE(sv.value_number_to,sv.value_number)<=$${values.length}`);}
      if(filter.optionKey!==undefined){values.push(filter.optionKey);conditions.push(`so.value_key=$${values.length}`);}
      if(filter.text!==undefined){values.push('%'+filter.text+'%');conditions.push(`COALESCE(sv.display_value_ar,sv.display_value_en,sv.value_text_ar,sv.value_text_en) ILIKE $${values.length}`);}
      if(filter.boolean!==undefined){values.push(filter.boolean);conditions.push(`sv.value_boolean=$${values.length}`);}
      modelConditions.push(`EXISTS(SELECT 1 FROM product_model_specification_values sv
        JOIN specification_definitions sd ON sd.id=sv.specification_id LEFT JOIN specification_options so ON so.id=sv.option_id
        WHERE ${conditions.join(' AND ')})`);
    }
    if(modelConditions.length)where.push(`EXISTS(SELECT 1 FROM product_models m WHERE m.product_id=p.id AND m.is_active AND ${modelConditions.join(' AND ')})`);
    const clause=where.join(' AND ');
    const count=await this.database.query<{count:string}>(`SELECT COUNT(DISTINCT p.id)::text AS count FROM products p
      LEFT JOIN brands b ON b.id=p.brand_id WHERE ${clause}`,values);
    const searchIndex=query.search?1:null;const matchingCondition=[`mm.product_id=p.id`,`mm.is_active`];
    if(searchIndex)matchingCondition.push(`(mm.model_code ILIKE $${searchIndex} OR mm.title_ar ILIKE $${searchIndex} OR mm.title_en ILIKE $${searchIndex} OR mm.sku ILIKE $${searchIndex} OR mm.barcode ILIKE $${searchIndex})`);
    if(modelConditions.length)matchingCondition.push(...modelConditions.map(condition=>condition.replaceAll('m.id','mm.id')));
    values.push(pageSize,(page-1)*pageSize);const limit=values.length-1,offset=values.length;
    const rows=await this.database.query(`SELECT p.id,p.slug,p.title_ar,p.title_en,p.short_description_ar,p.short_description_en,
      p.is_featured,p.quote_enabled,p.updated_at,b.id AS brand_id,b.title_ar AS brand_title_ar,b.title_en AS brand_title_en,b.slug AS brand_slug,
      c.id AS category_id,c.title_ar AS category_title_ar,c.title_en AS category_title_en,c.slug AS category_slug,
      (SELECT COALESCE(mi.image_url,pi.image_url) FROM product_models dm
        LEFT JOIN LATERAL(SELECT image_url FROM product_model_images WHERE model_id=dm.id ORDER BY is_primary DESC,sort_order LIMIT 1) mi ON TRUE
        LEFT JOIN LATERAL(SELECT image_url FROM product_images WHERE product_id=p.id ORDER BY is_primary DESC,sort_order LIMIT 1) pi ON TRUE
        WHERE dm.product_id=p.id AND dm.is_active ORDER BY dm.is_default DESC,dm.sort_order LIMIT 1) AS primary_image_url,
      (SELECT COUNT(*)::int FROM product_models WHERE product_id=p.id AND is_active) AS model_count,
      (SELECT id FROM product_models WHERE product_id=p.id AND is_active ORDER BY is_default DESC,sort_order LIMIT 1) AS default_model_id,
      (SELECT json_agg(mm.model_code ORDER BY mm.sort_order) FROM product_models mm WHERE ${matchingCondition.join(' AND ')}) AS matching_model_codes
      FROM products p JOIN categories c ON c.id=p.primary_category_id LEFT JOIN brands b ON b.id=p.brand_id
      WHERE ${clause} ORDER BY p.is_featured DESC,p.sort_order,p.created_at DESC LIMIT $${limit} OFFSET $${offset}`,values);
    return{items:rows.rows,count:Number(count.rows[0]?.count??0),page,pageSize};
  }

  async publicBySlug(slug:string):Promise<Record<string,unknown>>{
    const productResult=await this.database.query(`SELECT p.*,b.title_ar AS brand_title_ar,b.title_en AS brand_title_en,b.slug AS brand_slug,
      c.title_ar AS category_title_ar,c.title_en AS category_title_en,c.slug AS category_slug
      FROM products p JOIN categories c ON c.id=p.primary_category_id LEFT JOIN brands b ON b.id=p.brand_id
      WHERE p.slug=$1 AND p.status='published'`,[slug]);
    const product=productResult.rows[0] as Record<string,unknown>|undefined;if(!product)throw new NotFoundException('Product not found');
    const id=String(product.id);
    const [images,models,specifications,breadcrumbs,related]=await Promise.all([
      this.database.query(`SELECT * FROM product_images WHERE product_id=$1 ORDER BY is_primary DESC,sort_order`,[id]),
      this.database.query(`SELECT m.*,COALESCE((SELECT json_agg(i ORDER BY i.is_primary DESC,i.sort_order) FROM product_model_images i WHERE i.model_id=m.id),'[]') AS images
        FROM product_models m WHERE m.product_id=$1 AND m.is_active ORDER BY m.is_default DESC,m.sort_order`,[id]),
      this.database.query(`SELECT sv.*,sd.slug,sd.name_ar,sd.name_en,sd.value_type,sd.unit_ar,sd.unit_en,
        COALESCE(cs.is_comparable_override,sd.is_comparable) AS comparable,o.value_key,o.label_ar AS option_label_ar,o.label_en AS option_label_en
        FROM product_model_specification_values sv JOIN product_models m ON m.id=sv.model_id
        JOIN specification_definitions sd ON sd.id=sv.specification_id
        LEFT JOIN category_specifications cs ON cs.category_id=$2 AND cs.specification_id=sd.id
        LEFT JOIN specification_options o ON o.id=sv.option_id WHERE m.product_id=$1 ORDER BY sv.model_id,COALESCE(cs.sort_order,sd.sort_order),sv.sort_order`,[id,product.primary_category_id]),
      this.database.query(`WITH RECURSIVE trail AS (SELECT id,parent_id,title_ar,title_en,slug,0 AS depth FROM categories WHERE id=$1
        UNION ALL SELECT c.id,c.parent_id,c.title_ar,c.title_en,c.slug,t.depth+1 FROM categories c JOIN trail t ON t.parent_id=c.id)
        SELECT id,title_ar,title_en,slug FROM trail ORDER BY depth DESC`,[product.primary_category_id]),
      this.related(id),
    ]);
    const specsByModel=new Map<string,unknown[]>();for(const spec of specifications.rows){const key=String(spec.model_id);const list=specsByModel.get(key)??[];list.push(spec);specsByModel.set(key,list);}
    const fallbackImages=images.rows;
    const mappedModels:Array<Record<string,unknown>>=models.rows.map((model:Record<string,unknown>)=>({
      ...model,images:(model.images as unknown[]).length?model.images:fallbackImages,specifications:specsByModel.get(String(model.id))??[],
      quantityRules:{minimum:Number(model.minimum_request_quantity),maximum:model.maximum_request_quantity===null?null:Number(model.maximum_request_quantity),step:Number(model.quantity_step),unit:model.unit_of_measure},
    }));
    return{...product,images:fallbackImages,breadcrumbs:breadcrumbs.rows,models:mappedModels,modelCount:mappedModels.length,
      defaultModelId:(mappedModels.find(model=>model.is_default)??mappedModels[0])?.id??null,relatedProducts:related};
  }

  async publicByModel(slug:string,modelCode:string):Promise<Record<string,unknown>>{
    const product=await this.publicBySlug(slug);const models=product.models as Array<Record<string,unknown>>;
    const model=models.find(item=>String(item.model_code).toLowerCase()===modelCode.toLowerCase());
    if(!model)throw new NotFoundException('Product model not found');return{...product,selectedModelId:model.id,selectedModel:model};
  }

  async compare(slug:string,codes:string[]):Promise<unknown>{
    const product=await this.publicBySlug(slug);const requested=new Set(codes.map(code=>code.toLowerCase()));
    const models=(product.models as Array<Record<string,unknown>>).filter(model=>!requested.size||requested.has(String(model.model_code).toLowerCase())).slice(0,4);
    if(models.length<2)throw new BadRequestException('Choose at least two valid models');return{productId:product.id,slug,models};
  }

  async adminList(query:ListProductsQuery):Promise<{items:unknown[];count:number;page:number;pageSize:number}>{
    const page=query.page??1,pageSize=query.pageSize??50,term='%'+(query.search??'')+'%';
    const count=await this.database.query<{count:string}>(`SELECT COUNT(*)::text AS count FROM products p WHERE $1='' OR p.title_ar ILIKE $2 OR p.title_en ILIKE $2
      OR EXISTS(SELECT 1 FROM product_models m WHERE m.product_id=p.id AND (m.model_code ILIKE $2 OR m.sku ILIKE $2))`,[query.search??'',term]);
    const rows=await this.database.query(`SELECT p.*,c.title_ar AS category_title_ar,b.title_ar AS brand_title_ar,
      (SELECT COUNT(*)::int FROM product_models WHERE product_id=p.id) AS model_count,
      (SELECT image_url FROM product_images WHERE product_id=p.id ORDER BY is_primary DESC,sort_order LIMIT 1) AS primary_image_url
      FROM products p JOIN categories c ON c.id=p.primary_category_id LEFT JOIN brands b ON b.id=p.brand_id
      WHERE $1='' OR p.title_ar ILIKE $2 OR p.title_en ILIKE $2 OR EXISTS(SELECT 1 FROM product_models m WHERE m.product_id=p.id AND (m.model_code ILIKE $2 OR m.sku ILIKE $2))
      ORDER BY p.updated_at DESC LIMIT $3 OFFSET $4`,[query.search??'',term,pageSize,(page-1)*pageSize]);
    return{items:rows.rows,count:Number(count.rows[0]?.count??0),page,pageSize};
  }

  async adminById(id:string):Promise<unknown>{
    const result=await this.database.query(`SELECT p.*,
      COALESCE((SELECT json_agg(i ORDER BY i.is_primary DESC,i.sort_order) FROM product_images i WHERE i.product_id=p.id),'[]') AS images,
      COALESCE((SELECT json_agg(pc.category_id) FROM product_categories pc WHERE pc.product_id=p.id),'[]') AS extra_category_ids,
      COALESCE((SELECT json_agg(r.related_product_id ORDER BY r.sort_order) FROM product_related_products r WHERE r.product_id=p.id),'[]') AS related_product_ids,
      (SELECT COUNT(*)::int FROM product_models WHERE product_id=p.id) AS model_count FROM products p WHERE p.id=$1`,[id]);
    if(!result.rows[0])throw new NotFoundException('Product not found');return result.rows[0];
  }

  async create(input:CreateProductDto):Promise<unknown>{const id=await this.database.transaction(async client=>{
    const result=await client.query<ProductIdRow>(`INSERT INTO products(external_key,primary_category_id,brand_id,title_ar,title_en,slug,
      short_description_ar,short_description_en,description_ar,description_en,video_url,tags,status,published_at,quote_enabled,is_featured,sort_order,
      seo_title_ar,seo_title_en,seo_description_ar,seo_description_en)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CASE WHEN $13='published' THEN NOW() ELSE NULL END,$14,$15,$16,$17,$18,$19,$20) RETURNING id`,
      [input.externalKey??null,input.primaryCategoryId,input.brandId??null,input.titleAr,input.titleEn??null,input.slug,input.shortDescriptionAr??null,
      input.shortDescriptionEn??null,input.descriptionAr??null,input.descriptionEn??null,input.videoUrl??null,input.tags??[],input.status??'draft',
      input.quoteEnabled??true,input.isFeatured??false,input.sortOrder??0,input.seoTitleAr??null,input.seoTitleEn??null,input.seoDescriptionAr??null,input.seoDescriptionEn??null]);
    await this.replaceChildren(client,result.rows[0].id,input.images??[],input.extraCategoryIds??[],input.relatedProductIds??[]);return result.rows[0].id;
  });return this.adminById(id);}

  async update(id:string,input:UpdateProductDto):Promise<unknown>{await this.database.transaction(async client=>{
    const fields:Record<string,string>={externalKey:'external_key',primaryCategoryId:'primary_category_id',brandId:'brand_id',titleAr:'title_ar',titleEn:'title_en',slug:'slug',
      shortDescriptionAr:'short_description_ar',shortDescriptionEn:'short_description_en',descriptionAr:'description_ar',descriptionEn:'description_en',videoUrl:'video_url',
      tags:'tags',status:'status',quoteEnabled:'quote_enabled',isFeatured:'is_featured',sortOrder:'sort_order',seoTitleAr:'seo_title_ar',seoTitleEn:'seo_title_en',
      seoDescriptionAr:'seo_description_ar',seoDescriptionEn:'seo_description_en'};
    const changes=Object.entries(fields).filter(([key])=>(input as Record<string,unknown>)[key]!==undefined);
    if(changes.length){const values=changes.map(([key])=>(input as Record<string,unknown>)[key]);const assignments=changes.map(([,column],i)=>`${column}=$${i+2}`);
      assignments.push(`updated_at=NOW()`,`published_at=CASE WHEN ${changes.some(([,column])=>column==='status')?`$${changes.findIndex(([,column])=>column==='status')+2}`:'status'}='published' THEN COALESCE(published_at,NOW()) ELSE published_at END`);
      const result=await client.query(`UPDATE products SET ${assignments.join(',')} WHERE id=$1 RETURNING id`,[id,...values]);if(!result.rowCount)throw new NotFoundException('Product not found');}
    else if(input.images===undefined&&input.extraCategoryIds===undefined&&input.relatedProductIds===undefined)throw new BadRequestException('No supported fields supplied');
    if(input.images!==undefined)await this.replaceImages(client,id,input.images);
    if(input.extraCategoryIds!==undefined)await this.replaceExtraCategories(client,id,input.extraCategoryIds);
    if(input.relatedProductIds!==undefined)await this.replaceRelated(client,id,input.relatedProductIds);
  });return this.adminById(id);}

  async publish(id:string):Promise<unknown>{const result=await this.database.query(`UPDATE products SET status='published',published_at=COALESCE(published_at,NOW()),updated_at=NOW() WHERE id=$1 RETURNING *`,[id]);
    if(!result.rows[0])throw new NotFoundException('Product not found');return result.rows[0];}
  async archive(id:string):Promise<unknown>{const result=await this.database.query(`UPDATE products SET status='archived',quote_enabled=FALSE,updated_at=NOW() WHERE id=$1 RETURNING *`,[id]);
    if(!result.rows[0])throw new NotFoundException('Product not found');return result.rows[0];}
  async remove(id:string):Promise<void>{await this.archive(id);}

  async related(id:string):Promise<unknown[]>{return(await this.database.query(`SELECT p.*,
    (SELECT COALESCE(mi.image_url,pi.image_url) FROM product_models m
      LEFT JOIN LATERAL(SELECT image_url FROM product_model_images WHERE model_id=m.id ORDER BY is_primary DESC,sort_order LIMIT 1) mi ON TRUE
      LEFT JOIN LATERAL(SELECT image_url FROM product_images WHERE product_id=p.id ORDER BY is_primary DESC,sort_order LIMIT 1) pi ON TRUE
      WHERE m.product_id=p.id AND m.is_active ORDER BY m.is_default DESC,m.sort_order LIMIT 1) AS primary_image_url,
    (SELECT COUNT(*)::int FROM product_models WHERE product_id=p.id AND is_active) AS model_count
    FROM product_related_products r JOIN products p ON p.id=r.related_product_id WHERE r.product_id=$1 AND p.status='published' ORDER BY r.sort_order`,[id])).rows;}

  private parseFilters(raw?:string):PublicFilter[]{if(!raw)return[];try{const value=JSON.parse(raw) as unknown;if(!Array.isArray(value)||value.length>20)throw new Error();
    return value.map(item=>{if(!item||typeof item!=='object'||typeof (item as PublicFilter).slug!=='string')throw new Error();return item as PublicFilter;});}
    catch{throw new BadRequestException('Invalid specification filters');}}
  private async replaceChildren(db:DbExecutor,id:string,images:ProductImageDto[],categories:string[],related:string[]):Promise<void>{
    await this.replaceImages(db,id,images);await this.replaceExtraCategories(db,id,categories);await this.replaceRelated(db,id,related);}
  private async replaceImages(db:DbExecutor,id:string,images:ProductImageDto[]):Promise<void>{
    if(images.filter(image=>image.isPrimary).length>1)throw new BadRequestException('Only one primary image is allowed');
    await db.query('DELETE FROM product_images WHERE product_id=$1',[id]);for(const image of images)await db.query(`INSERT INTO product_images(product_id,media_asset_id,image_url,alt_text_ar,alt_text_en,is_primary,sort_order)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,image.mediaAssetId??null,image.imageUrl,image.altTextAr??null,image.altTextEn??null,image.isPrimary??false,image.sortOrder??0]);}
  private async replaceExtraCategories(db:DbExecutor,id:string,categoryIds:string[]):Promise<void>{await db.query('DELETE FROM product_categories WHERE product_id=$1',[id]);
    for(const categoryId of [...new Set(categoryIds)])await db.query('INSERT INTO product_categories(product_id,category_id) VALUES($1,$2)',[id,categoryId]);}
  private async replaceRelated(db:DbExecutor,id:string,relatedIds:string[]):Promise<void>{await db.query('DELETE FROM product_related_products WHERE product_id=$1',[id]);
    for(const [sortOrder,relatedId] of [...new Set(relatedIds)].entries())if(relatedId!==id)await db.query('INSERT INTO product_related_products(product_id,related_product_id,sort_order) VALUES($1,$2,$3)',[id,relatedId,sortOrder]);}
}
