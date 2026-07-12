import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { CreateCatalogValueDto, UpdateCatalogValueDto, UpsertCatalogEntryDto } from './dto';
type Kind='categories'|'brands'|'attributes'|'filters';
@Injectable()
export class CatalogService{
  constructor(private readonly database:DatabaseService){}
  async publicCategories():Promise<unknown[]>{return (await this.database.query(
    `SELECT c.*,COALESCE(json_agg(child ORDER BY child.sort_order) FILTER(WHERE child.id IS NOT NULL),'[]') AS children
      FROM categories c LEFT JOIN categories child ON child.parent_id=c.id AND child.is_active=TRUE
      WHERE c.is_active=TRUE AND c.parent_id IS NULL GROUP BY c.id ORDER BY c.sort_order,c.title_ar`)).rows;}
  async publicCategory(slug:string):Promise<unknown>{
    const result=await this.database.query('SELECT * FROM categories WHERE slug=$1 AND is_active=TRUE',[slug]);
    if(!result.rows[0])throw new NotFoundException('Category not found');return result.rows[0];
  }
  async publicBrands():Promise<unknown[]>{return (await this.database.query(
    'SELECT * FROM brands WHERE is_active=TRUE ORDER BY sort_order,title_ar')).rows;}
  async publicFilters():Promise<unknown[]>{return(await this.database.query(`SELECT f.*,
    COALESCE((SELECT json_agg(v ORDER BY v.sort_order) FROM filter_values v WHERE v.filter_id=f.id),'[]') AS values
    FROM filters f WHERE f.is_active=TRUE ORDER BY f.sort_order,f.name_ar`)).rows;}
  async publicBrand(slug:string):Promise<unknown>{
    const result=await this.database.query('SELECT * FROM brands WHERE slug=$1 AND is_active=TRUE',[slug]);
    if(!result.rows[0])throw new NotFoundException('Brand not found');return result.rows[0];
  }
  async list(kind:Kind):Promise<unknown[]>{this.assertKind(kind);
    if(kind==='attributes'||kind==='filters'){
      const valueTable=kind==='attributes'?'attribute_values':'filter_values';const foreign=kind==='attributes'?'attribute_id':'filter_id';
      return(await this.database.query(`SELECT e.*,COALESCE((SELECT json_agg(v ORDER BY v.sort_order,v.value_ar)
        FROM ${valueTable} v WHERE v.${foreign}=e.id),'[]') AS values FROM ${kind} e ORDER BY e.sort_order,e.created_at DESC`)).rows;
    }
    if(kind==='categories')return(await this.database.query(`SELECT c.*,COALESCE((SELECT json_agg(ca.attribute_id ORDER BY ca.sort_order)
      FROM category_attributes ca WHERE ca.category_id=c.id),'[]') AS attribute_ids FROM categories c ORDER BY c.sort_order,c.created_at DESC`)).rows;
    return (await this.database.query('SELECT * FROM '+kind+' ORDER BY sort_order,created_at DESC')).rows;}
  async create(kind:Kind,input:UpsertCatalogEntryDto):Promise<unknown>{
    this.assertKind(kind);
    if(kind==='categories'){
      if(!input.titleAr)throw new BadRequestException('Arabic title is required');
      return (await this.database.query(`INSERT INTO categories(parent_id,title_ar,title_en,slug,description_ar,description_en,image_url,
        seo_title_ar,seo_title_en,seo_description_ar,seo_description_en,is_active,sort_order)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[input.parentId??null,input.titleAr,input.titleEn??null,input.slug,
        input.descriptionAr??null,input.descriptionEn??null,input.imageUrl??null,input.seoTitleAr??null,input.seoTitleEn??null,
        input.seoDescriptionAr??null,input.seoDescriptionEn??null,input.isActive??true,input.sortOrder??0])).rows[0];
    }
    if(kind==='brands'){
      if(!input.titleAr)throw new BadRequestException('Arabic title is required');
      return (await this.database.query(`INSERT INTO brands(title_ar,title_en,slug,description_ar,description_en,logo_url,
        seo_title_ar,seo_title_en,seo_description_ar,seo_description_en,is_active,sort_order)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[input.titleAr,input.titleEn??null,input.slug,input.descriptionAr??null,
        input.descriptionEn??null,input.logoUrl??null,input.seoTitleAr??null,input.seoTitleEn??null,input.seoDescriptionAr??null,
        input.seoDescriptionEn??null,input.isActive??true,input.sortOrder??0])).rows[0];
    }
    if(!input.nameAr)throw new BadRequestException('Arabic name is required');
    if(kind==='attributes')return (await this.database.query(`INSERT INTO attributes(name_ar,name_en,slug,input_type,is_filterable,is_active,sort_order)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[input.nameAr,input.nameEn??null,input.slug,input.inputType??'select',input.isFilterable??true,
      input.isActive??true,input.sortOrder??0])).rows[0];
    return (await this.database.query(`INSERT INTO filters(name_ar,name_en,slug,filter_type,is_active,sort_order)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[input.nameAr,input.nameEn??null,input.slug,input.filterType??'option',input.isActive??true,input.sortOrder??0])).rows[0];
  }
  async update(kind:Kind,id:string,input:UpsertCatalogEntryDto):Promise<unknown>{
    this.assertKind(kind);
    const columns:{key:keyof UpsertCatalogEntryDto;column:string}[]=[
      {key:'parentId',column:'parent_id'},{key:'titleAr',column:'title_ar'},{key:'titleEn',column:'title_en'},
      {key:'slug',column:'slug'},{key:'descriptionAr',column:'description_ar'},{key:'descriptionEn',column:'description_en'},
      {key:'imageUrl',column:'image_url'},{key:'logoUrl',column:'logo_url'},{key:'nameAr',column:'name_ar'},
      {key:'seoTitleAr',column:'seo_title_ar'},{key:'seoTitleEn',column:'seo_title_en'},
      {key:'seoDescriptionAr',column:'seo_description_ar'},{key:'seoDescriptionEn',column:'seo_description_en'},
      {key:'nameEn',column:'name_en'},{key:'inputType',column:'input_type'},{key:'filterType',column:'filter_type'},
      {key:'isFilterable',column:'is_filterable'},{key:'isActive',column:'is_active'},{key:'sortOrder',column:'sort_order'}];
    const permitted=this.allowedColumns(kind);const changes=columns.filter((item)=>permitted.has(item.column)&&input[item.key]!==undefined);
    if(!changes.length)throw new BadRequestException('No supported fields supplied');
    const values=changes.map((item)=>input[item.key]);const assignments=changes.map((item,index)=>item.column+'=$'+(index+2)).join(',');
    const result=await this.database.query('UPDATE '+kind+' SET '+assignments+(kind==='categories'||kind==='brands'?',updated_at=NOW()':'')+' WHERE id=$1 RETURNING *',[id,...values]);
    if(!result.rows[0])throw new NotFoundException('Catalog entry not found');return result.rows[0];
  }
  async remove(kind:Kind,id:string):Promise<void>{this.assertKind(kind);const result=await this.database.query('DELETE FROM '+kind+' WHERE id=$1',[id]);
    if(!result.rowCount)throw new NotFoundException('Catalog entry not found');}
  async addValue(kind:'attributes'|'filters',id:string,input:CreateCatalogValueDto):Promise<unknown>{
    const table=kind==='attributes'?'attribute_values':'filter_values';const foreign=kind==='attributes'?'attribute_id':'filter_id';
    const columns=kind==='attributes'?'('+foreign+',value_ar,value_en,code,sort_order)':'('+foreign+',value_ar,value_en,sort_order)';
    const values=kind==='attributes'?[id,input.valueAr,input.valueEn??null,input.code??null,input.sortOrder??0]:[id,input.valueAr,input.valueEn??null,input.sortOrder??0];
    const markers=values.map((_,index)=>'$'+(index+1)).join(',');
    return (await this.database.query('INSERT INTO '+table+columns+' VALUES('+markers+') RETURNING *',values)).rows[0];
  }
  async updateValue(kind:'attributes'|'filters',id:string,valueId:string,input:UpdateCatalogValueDto):Promise<unknown>{
    const table=kind==='attributes'?'attribute_values':'filter_values';const foreign=kind==='attributes'?'attribute_id':'filter_id';
    const result=await this.database.query(`UPDATE ${table} SET value_ar=$3,value_en=$4,sort_order=$5${kind==='attributes'?',code=$6':''}
      WHERE id=$1 AND ${foreign}=$2 RETURNING *`,kind==='attributes'?[valueId,id,input.valueAr,input.valueEn??null,input.sortOrder??0,input.code??null]:
      [valueId,id,input.valueAr,input.valueEn??null,input.sortOrder??0]);
    if(!result.rows[0])throw new NotFoundException('Catalog value not found');return result.rows[0];
  }
  async removeValue(kind:'attributes'|'filters',id:string,valueId:string):Promise<void>{
    const table=kind==='attributes'?'attribute_values':'filter_values';const foreign=kind==='attributes'?'attribute_id':'filter_id';
    const result=await this.database.query(`DELETE FROM ${table} WHERE id=$1 AND ${foreign}=$2`,[valueId,id]);
    if(!result.rowCount)throw new NotFoundException('Catalog value not found');
  }
  async replaceCategoryAttributes(categoryId:string,attributeIds:string[]):Promise<void>{await this.database.transaction(async client=>{
    const category=await client.query('SELECT 1 FROM categories WHERE id=$1',[categoryId]);if(!category.rowCount)throw new NotFoundException('Category not found');
    await client.query('DELETE FROM category_attributes WHERE category_id=$1',[categoryId]);
    for(let index=0;index<attributeIds.length;index++)await client.query(
      'INSERT INTO category_attributes(category_id,attribute_id,sort_order) VALUES($1,$2,$3)',[categoryId,attributeIds[index],index]);
  });}
  private assertKind(kind:string):asserts kind is Kind{if(!['categories','brands','attributes','filters'].includes(kind))throw new BadRequestException('Unsupported catalog type');}
  private allowedColumns(kind:Kind):Set<string>{
    const seo=['seo_title_ar','seo_title_en','seo_description_ar','seo_description_en'];
    const map:Record<Kind,string[]>={categories:['parent_id','title_ar','title_en','slug','description_ar','description_en','image_url','is_active','sort_order',...seo],
      brands:['title_ar','title_en','slug','description_ar','description_en','logo_url','is_active','sort_order',...seo],
      attributes:['name_ar','name_en','slug','input_type','is_filterable','is_active','sort_order'],
      filters:['name_ar','name_en','slug','filter_type','is_active','sort_order']};return new Set(map[kind]);
  }
}
