import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, DbExecutor } from '../database/database.service';
import type { CategorySpecificationDto, CreateBrandDto, CreateCategoryDto, CreateSpecificationDto, SpecificationOptionDto, UpdateBrandDto, UpdateCategoryDto, UpdateSpecificationDto } from './dto';

type Row=Record<string,unknown>&{id:string;parent_id?:string|null};

@Injectable()
export class CatalogService {
  constructor(private readonly database:DatabaseService){}

  async publicCategories():Promise<unknown[]>{const rows=(await this.database.query(`SELECT c.*,
    (SELECT COUNT(*)::int FROM products p WHERE p.primary_category_id=c.id AND p.status='published') AS direct_product_count
    FROM categories c WHERE c.is_active ORDER BY c.sort_order,c.title_ar`)).rows as Row[];return this.tree(rows);}
  async publicCategory(slug:string):Promise<unknown>{const result=await this.database.query(`SELECT c.*,
    (WITH RECURSIVE trail AS (SELECT id,parent_id,title_ar,title_en,slug,0 depth FROM categories WHERE id=c.id
      UNION ALL SELECT p.id,p.parent_id,p.title_ar,p.title_en,p.slug,t.depth+1 FROM categories p JOIN trail t ON t.parent_id=p.id)
      SELECT json_agg(jsonb_build_object('id',id,'title_ar',title_ar,'title_en',title_en,'slug',slug) ORDER BY depth DESC) FROM trail) AS breadcrumbs
    FROM categories c WHERE c.slug=$1 AND c.is_active`,[slug]);if(!result.rows[0])throw new NotFoundException('Category not found');return result.rows[0];}
  async publicCategoryProducts(slug:string):Promise<unknown[]>{return(await this.database.query(`WITH RECURSIVE descendants AS (
    SELECT id FROM categories WHERE slug=$1 AND is_active UNION ALL SELECT c.id FROM categories c JOIN descendants d ON c.parent_id=d.id WHERE c.is_active)
    SELECT DISTINCT p.id,p.slug,p.title_ar,p.title_en,p.short_description_ar,p.short_description_en,
      (SELECT COUNT(*)::int FROM product_models WHERE product_id=p.id AND is_active) AS model_count,
      (SELECT COALESCE(mi.image_url,pi.image_url) FROM product_models m
        LEFT JOIN LATERAL(SELECT image_url FROM product_model_images WHERE model_id=m.id ORDER BY is_primary DESC,sort_order LIMIT 1) mi ON TRUE
        LEFT JOIN LATERAL(SELECT image_url FROM product_images WHERE product_id=p.id ORDER BY is_primary DESC,sort_order LIMIT 1) pi ON TRUE
        WHERE m.product_id=p.id AND m.is_active ORDER BY m.is_default DESC,m.sort_order LIMIT 1) AS primary_image_url
    FROM products p LEFT JOIN product_categories pc ON pc.product_id=p.id WHERE p.status='published'
      AND (p.primary_category_id IN (SELECT id FROM descendants) OR pc.category_id IN (SELECT id FROM descendants)) ORDER BY p.sort_order,p.title_ar`,[slug])).rows;}
  async publicBrands():Promise<unknown[]>{return(await this.database.query('SELECT * FROM brands WHERE is_active ORDER BY sort_order,title_ar')).rows;}
  async publicBrand(slug:string):Promise<unknown>{const result=await this.database.query('SELECT * FROM brands WHERE slug=$1 AND is_active',[slug]);if(!result.rows[0])throw new NotFoundException('Brand not found');return result.rows[0];}
  async publicFilters(category?:string):Promise<unknown[]>{const values:unknown[]=[];let categoryClause='';if(category){values.push(category);categoryClause=`AND cs.category_id IN (
    WITH RECURSIVE ancestors AS (SELECT id,parent_id FROM categories WHERE slug=$1 UNION ALL SELECT c.id,c.parent_id FROM categories c JOIN ancestors a ON a.parent_id=c.id) SELECT id FROM ancestors)`;}
    return(await this.database.query(`SELECT sd.*,
      COALESCE((SELECT json_agg(o ORDER BY o.sort_order) FROM specification_options o WHERE o.specification_id=sd.id AND o.is_active),'[]') AS options,
      MIN(sv.value_number) AS minimum_value,MAX(COALESCE(sv.value_number_to,sv.value_number)) AS maximum_value
      FROM specification_definitions sd LEFT JOIN category_specifications cs ON cs.specification_id=sd.id
      LEFT JOIN product_model_specification_values sv ON sv.specification_id=sd.id
      LEFT JOIN product_models m ON m.id=sv.model_id AND m.is_active
      WHERE sd.is_active AND COALESCE(cs.is_filterable_override,sd.is_filterable) ${categoryClause}
      GROUP BY sd.id ORDER BY MIN(COALESCE(cs.sort_order,sd.sort_order)),sd.sort_order`,values)).rows;}

  async categories():Promise<unknown[]>{const rows=(await this.database.query('SELECT * FROM categories ORDER BY sort_order,title_ar')).rows as Row[];return this.tree(rows);}
  async createCategory(input:CreateCategoryDto):Promise<unknown>{return(await this.database.query(`INSERT INTO categories(parent_id,external_key,catalog_code,title_ar,title_en,slug,description_ar,description_en,image_url,icon_key,is_active,sort_order)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[input.parentId??null,input.externalKey??null,input.catalogCode??null,input.titleAr,input.titleEn??null,input.slug,
    input.descriptionAr??null,input.descriptionEn??null,input.imageUrl??null,input.iconKey??null,input.isActive??true,input.sortOrder??0])).rows[0];}
  updateCategory(id:string,input:UpdateCategoryDto):Promise<unknown>{return this.dynamicUpdate('categories',id,input,{parentId:'parent_id',externalKey:'external_key',catalogCode:'catalog_code',titleAr:'title_ar',titleEn:'title_en',slug:'slug',descriptionAr:'description_ar',descriptionEn:'description_en',imageUrl:'image_url',iconKey:'icon_key',isActive:'is_active',sortOrder:'sort_order'});}
  async removeCategory(id:string):Promise<void>{const result=await this.database.query('DELETE FROM categories WHERE id=$1',[id]);if(!result.rowCount)throw new NotFoundException('Category not found');}
  async reorderCategories(ids:string[]):Promise<void>{if(new Set(ids).size!==ids.length)throw new BadRequestException('Duplicate category IDs');await this.database.transaction(async client=>{for(const[index,id]of ids.entries()){
    const result=await client.query('UPDATE categories SET sort_order=$2,updated_at=NOW() WHERE id=$1',[id,index]);if(!result.rowCount)throw new NotFoundException('Category not found');}});}
  brands():Promise<unknown[]>{return this.database.query('SELECT * FROM brands ORDER BY sort_order,title_ar').then(result=>result.rows);}
  async createBrand(input:CreateBrandDto):Promise<unknown>{return(await this.database.query(`INSERT INTO brands(external_key,title_ar,title_en,slug,description_ar,description_en,logo_url,is_active,sort_order)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[input.externalKey??null,input.titleAr,input.titleEn??null,input.slug,input.descriptionAr??null,input.descriptionEn??null,input.logoUrl??null,input.isActive??true,input.sortOrder??0])).rows[0];}
  updateBrand(id:string,input:UpdateBrandDto):Promise<unknown>{return this.dynamicUpdate('brands',id,input,{externalKey:'external_key',titleAr:'title_ar',titleEn:'title_en',slug:'slug',descriptionAr:'description_ar',descriptionEn:'description_en',logoUrl:'logo_url',isActive:'is_active',sortOrder:'sort_order'});}
  async removeBrand(id:string):Promise<void>{const result=await this.database.query('DELETE FROM brands WHERE id=$1',[id]);if(!result.rowCount)throw new NotFoundException('Brand not found');}

  specifications():Promise<unknown[]>{return this.database.query(`SELECT sd.*,COALESCE((SELECT json_agg(o ORDER BY o.sort_order) FROM specification_options o WHERE o.specification_id=sd.id),'[]') AS options,
    COALESCE((SELECT json_agg(cs.category_id) FROM category_specifications cs WHERE cs.specification_id=sd.id),'[]') AS category_ids
    FROM specification_definitions sd ORDER BY sd.sort_order,sd.created_at`).then(result=>result.rows);}
  async specification(id:string):Promise<unknown>{const result=await this.database.query(`SELECT sd.*,COALESCE((SELECT json_agg(o ORDER BY o.sort_order) FROM specification_options o WHERE o.specification_id=sd.id),'[]') AS options
    FROM specification_definitions sd WHERE sd.id=$1`,[id]);if(!result.rows[0])throw new NotFoundException('Specification not found');return result.rows[0];}
  async createSpecification(input:CreateSpecificationDto):Promise<unknown>{const id=await this.database.transaction(async client=>{const result=await client.query<{id:string}>(`INSERT INTO specification_definitions(slug,name_ar,name_en,value_type,unit_ar,unit_en,is_required_default,is_filterable,is_comparable,is_active,sort_order)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,[input.slug,input.nameAr,input.nameEn??null,input.valueType,input.unitAr??null,input.unitEn??null,
    input.isRequiredDefault??false,input.isFilterable??false,input.isComparable??true,input.isActive??true,input.sortOrder??0]);await this.replaceOptions(client,result.rows[0].id,input.options??[]);return result.rows[0].id;});return this.specification(id);}
  async updateSpecification(id:string,input:UpdateSpecificationDto):Promise<unknown>{await this.database.transaction(async client=>{const fields={slug:'slug',nameAr:'name_ar',nameEn:'name_en',valueType:'value_type',unitAr:'unit_ar',unitEn:'unit_en',isRequiredDefault:'is_required_default',isFilterable:'is_filterable',isComparable:'is_comparable',isActive:'is_active',sortOrder:'sort_order'};
    const record=input as unknown as Record<string,unknown>;const changes=Object.entries(fields).filter(([key])=>record[key]!==undefined);if(changes.length){const result=await client.query(`UPDATE specification_definitions SET ${changes.map(([,column],i)=>`${column}=$${i+2}`).join(',')},updated_at=NOW() WHERE id=$1 RETURNING id`,[id,...changes.map(([key])=>record[key])]);if(!result.rowCount)throw new NotFoundException('Specification not found');}
    if(input.options!==undefined)await this.replaceOptions(client,id,input.options);if(!changes.length&&input.options===undefined)throw new BadRequestException('No supported fields supplied');});return this.specification(id);}
  async removeSpecification(id:string):Promise<void>{const result=await this.database.query('DELETE FROM specification_definitions WHERE id=$1',[id]);if(!result.rowCount)throw new NotFoundException('Specification not found');}
  async categorySpecifications(categoryId:string):Promise<unknown[]>{return(await this.database.query(`WITH RECURSIVE ancestors AS (
    SELECT id,parent_id,0 depth FROM categories WHERE id=$1 UNION ALL SELECT c.id,c.parent_id,a.depth+1 FROM categories c JOIN ancestors a ON a.parent_id=c.id)
    SELECT DISTINCT ON (sd.id) sd.*,cs.is_required,cs.is_filterable_override,cs.is_comparable_override,cs.sort_order,cs.category_id,a.depth,
      COALESCE((SELECT json_agg(o ORDER BY o.sort_order) FROM specification_options o WHERE o.specification_id=sd.id AND o.is_active),'[]') AS options
    FROM ancestors a JOIN category_specifications cs ON cs.category_id=a.id JOIN specification_definitions sd ON sd.id=cs.specification_id
    ORDER BY sd.id,a.depth,cs.sort_order`,[categoryId])).rows;}
  async replaceCategorySpecifications(categoryId:string,values:CategorySpecificationDto[]):Promise<void>{await this.database.transaction(async client=>{const category=await client.query('SELECT 1 FROM categories WHERE id=$1',[categoryId]);if(!category.rowCount)throw new NotFoundException('Category not found');
    await client.query('DELETE FROM category_specifications WHERE category_id=$1',[categoryId]);for(const value of values)await client.query(`INSERT INTO category_specifications(category_id,specification_id,is_required,is_filterable_override,is_comparable_override,sort_order)
      VALUES($1,$2,$3,$4,$5,$6)`,[categoryId,value.specificationId,value.isRequired??false,value.isFilterableOverride??null,value.isComparableOverride??null,value.sortOrder??0]);});}

  private tree(rows:Row[]):unknown[]{const byId=new Map(rows.map(row=>[row.id,{...row,children:[] as unknown[]}])) as Map<string,Row&{children:unknown[]}>;const roots:unknown[]=[];
    for(const row of byId.values()){if(row.parent_id&&byId.has(row.parent_id))byId.get(row.parent_id)!.children.push(row);else roots.push(row);}return roots;}
  private async dynamicUpdate(table:'categories'|'brands',id:string,input:object,fields:Record<string,string>):Promise<unknown>{const record=input as Record<string,unknown>;const changes=Object.entries(fields).filter(([key])=>record[key]!==undefined);
    if(!changes.length)throw new BadRequestException('No supported fields supplied');const result=await this.database.query(`UPDATE ${table} SET ${changes.map(([,column],i)=>`${column}=$${i+2}`).join(',')},updated_at=NOW() WHERE id=$1 RETURNING *`,[id,...changes.map(([key])=>record[key])]);
    if(!result.rows[0])throw new NotFoundException('Catalog entry not found');return result.rows[0];}
  private async replaceOptions(db:DbExecutor,specificationId:string,options:SpecificationOptionDto[]):Promise<void>{await db.query('DELETE FROM specification_options WHERE specification_id=$1',[specificationId]);
    for(const option of options)await db.query(`INSERT INTO specification_options(specification_id,value_key,label_ar,label_en,sort_order,is_active) VALUES($1,$2,$3,$4,$5,$6)`,
      [specificationId,option.valueKey,option.labelAr,option.labelEn??null,option.sortOrder??0,option.isActive??true]);}
}
