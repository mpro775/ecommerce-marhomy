import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as ExcelJS from 'exceljs';
import * as unzipper from 'unzipper';
import { DatabaseService, DbExecutor } from '../database/database.service';
import { MediaService } from '../media/media.service';

type ImportRow=Record<string,string>&{_row:string};
interface ParsedImport {workbook:ExcelJS.Workbook;images:Map<string,Buffer>;hash:string;fileName:string}
export interface ImportIssue {sheet:string;row:number;field:string;message:string;severity:'error'|'warning'}
export interface ImportReport {summary:Record<string,number>;errors:ImportIssue[];warnings:ImportIssue[];sheets:Record<string,ImportRow[]>}

const SHEETS:Record<string,string[]>={
  Categories:['external_key','parent_external_key','catalog_code','title_ar','title_en','slug'],
  Products:['external_key','primary_category_key','title_ar','title_en','slug','brand_key'],
  Models:['product_key','model_code','sku','availability','unit','minimum','maximum','step','default'],
  SpecificationDefinitions:['slug','name_ar','name_en','type','unit_ar','unit_en','filterable','comparable'],
  CategorySpecifications:['category_key','specification_slug','required','filterable','comparable','sort_order'],
  ModelSpecifications:['product_key','model_code','specification_slug','value_text_ar','value_text_en','value_number','value_number_to','option_key'],
  ProductImages:['product_key','image_path_or_url','primary','sort_order','alt_ar','alt_en'],
  ModelImages:['product_key','model_code','image_path_or_url','primary','sort_order','alt_ar','alt_en'],
};

@Injectable()
export class CatalogImportService {
  constructor(private readonly database:DatabaseService,private readonly media:MediaService){}

  async template():Promise<Buffer>{const workbook=new ExcelJS.Workbook();for(const[name,columns]of Object.entries(SHEETS)){const sheet=workbook.addWorksheet(name);sheet.columns=columns.map(column=>({header:column,key:column,width:24}));
    sheet.views=[{state:'frozen',ySplit:1}];sheet.getRow(1).font={bold:true};}return Buffer.from(await workbook.xlsx.writeBuffer());}

  async validate(file:Express.Multer.File,userId:string):Promise<ImportReport&{jobId:string;fileHash:string}>{const parsed=await this.parse(file);const report=await this.buildReport(parsed);
    const job=await this.database.query<{id:string}>(`INSERT INTO catalog_import_jobs(file_name,file_hash,status,dry_run,summary,report,created_by_admin_user_id,completed_at)
      VALUES($1,$2,'validated',TRUE,$3,$4,$5,NOW()) ON CONFLICT(file_hash,dry_run) DO UPDATE SET file_name=EXCLUDED.file_name,status='validated',summary=EXCLUDED.summary,
      report=EXCLUDED.report,created_by_admin_user_id=EXCLUDED.created_by_admin_user_id,completed_at=NOW() RETURNING id`,
      [parsed.fileName,parsed.hash,report.summary,JSON.stringify([...report.errors,...report.warnings]),userId]);return{...report,jobId:job.rows[0].id,fileHash:parsed.hash};}

  async execute(file:Express.Multer.File,userId:string):Promise<unknown>{const parsed=await this.parse(file);const previous=await this.database.query(`SELECT * FROM catalog_import_jobs WHERE file_hash=$1 AND dry_run=FALSE AND status='completed'`,[parsed.hash]);
    if(previous.rows[0])return previous.rows[0];const report=await this.buildReport(parsed);if(report.errors.length)throw new BadRequestException({message:'Catalog import contains validation errors',report});
    const uploaded=new Map<string,{id:string;public_url:string}>();try{for(const path of this.archivePaths(report)){const buffer=parsed.images.get(this.normalizePath(path));if(!buffer)continue;
      const asset=await this.media.upload({buffer,originalname:path,mimetype:'application/octet-stream'} as Express.Multer.File,userId) as {id:string;public_url:string};uploaded.set(this.normalizePath(path),asset);}
      return await this.database.transaction(async client=>{await this.executeRows(client,report,uploaded);const job=await client.query(`INSERT INTO catalog_import_jobs(file_name,file_hash,status,dry_run,summary,report,created_by_admin_user_id,completed_at)
        VALUES($1,$2,'completed',FALSE,$3,$4,$5,NOW()) ON CONFLICT(file_hash,dry_run) DO UPDATE SET status='completed',summary=EXCLUDED.summary,report=EXCLUDED.report,completed_at=NOW() RETURNING *`,
        [parsed.fileName,parsed.hash,report.summary,JSON.stringify(report.warnings),userId]);await client.query(`INSERT INTO audit_logs(admin_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'catalog.import.executed','catalog_import',$2,$3)`,[userId,job.rows[0].id,{fileHash:parsed.hash,summary:report.summary}]);return job.rows[0];});
    }catch(error){for(const asset of uploaded.values()){try{await this.media.remove(asset.id);}catch{/** Compensating cleanup is best effort. */}}throw error;}}

  async history():Promise<unknown[]>{return(await this.database.query('SELECT * FROM catalog_import_jobs ORDER BY created_at DESC LIMIT 100')).rows;}
  async report(id:string):Promise<unknown>{const result=await this.database.query('SELECT * FROM catalog_import_jobs WHERE id=$1',[id]);if(!result.rows[0])throw new NotFoundException('Catalog import not found');return result.rows[0];}

  async exportWorkbook():Promise<Buffer>{const workbook=new ExcelJS.Workbook();const add=async(name:string,query:string,columns:string[])=>{const sheet=workbook.addWorksheet(name);sheet.columns=columns.map(key=>({header:key,key,width:24}));sheet.addRows((await this.database.query(query)).rows);};
    await add('Categories',`SELECT external_key,parent.external_key AS parent_external_key,catalog_code,c.title_ar,c.title_en,c.slug FROM categories c LEFT JOIN categories parent ON parent.id=c.parent_id ORDER BY c.sort_order`,SHEETS.Categories);
    await add('Products',`SELECT p.external_key,c.external_key AS primary_category_key,p.title_ar,p.title_en,p.slug,b.external_key AS brand_key FROM products p JOIN categories c ON c.id=p.primary_category_id LEFT JOIN brands b ON b.id=p.brand_id ORDER BY p.sort_order`,SHEETS.Products);
    await add('Models',`SELECT p.external_key AS product_key,m.model_code,m.sku,m.availability_status AS availability,m.unit_of_measure AS unit,m.minimum_request_quantity AS minimum,m.maximum_request_quantity AS maximum,m.quantity_step AS step,m.is_default AS default FROM product_models m JOIN products p ON p.id=m.product_id ORDER BY p.sort_order,m.sort_order`,SHEETS.Models);
    await add('SpecificationDefinitions',`SELECT slug,name_ar,name_en,value_type AS type,unit_ar,unit_en,is_filterable AS filterable,is_comparable AS comparable FROM specification_definitions ORDER BY sort_order`,SHEETS.SpecificationDefinitions);
    await add('CategorySpecifications',`SELECT c.external_key AS category_key,s.slug AS specification_slug,cs.is_required AS required,COALESCE(cs.is_filterable_override,s.is_filterable) AS filterable,COALESCE(cs.is_comparable_override,s.is_comparable) AS comparable,cs.sort_order FROM category_specifications cs JOIN categories c ON c.id=cs.category_id JOIN specification_definitions s ON s.id=cs.specification_id ORDER BY c.sort_order,cs.sort_order`,SHEETS.CategorySpecifications);
    await add('ModelSpecifications',`SELECT p.external_key AS product_key,m.model_code,s.slug AS specification_slug,sv.value_text_ar,sv.value_text_en,sv.value_number,sv.value_number_to,o.value_key AS option_key FROM product_model_specification_values sv JOIN product_models m ON m.id=sv.model_id JOIN products p ON p.id=m.product_id JOIN specification_definitions s ON s.id=sv.specification_id LEFT JOIN specification_options o ON o.id=sv.option_id ORDER BY p.sort_order,m.sort_order,sv.sort_order`,SHEETS.ModelSpecifications);
    await add('ProductImages',`SELECT p.external_key AS product_key,i.image_url AS image_path_or_url,i.is_primary AS primary,i.sort_order,i.alt_text_ar AS alt_ar,i.alt_text_en AS alt_en FROM product_images i JOIN products p ON p.id=i.product_id ORDER BY p.sort_order,i.sort_order`,SHEETS.ProductImages);
    await add('ModelImages',`SELECT p.external_key AS product_key,m.model_code,i.image_url AS image_path_or_url,i.is_primary AS primary,i.sort_order,i.alt_text_ar AS alt_ar,i.alt_text_en AS alt_en FROM product_model_images i JOIN product_models m ON m.id=i.model_id JOIN products p ON p.id=m.product_id ORDER BY p.sort_order,m.sort_order,i.sort_order`,SHEETS.ModelImages);
    return Buffer.from(await workbook.xlsx.writeBuffer());}

  private async parse(file:Express.Multer.File):Promise<ParsedImport>{if(!file?.buffer?.length)throw new BadRequestException('Catalog file is required');const hash=createHash('sha256').update(file.buffer).digest('hex');
    let workbookBuffer=file.buffer;const images=new Map<string,Buffer>();if(file.originalname.toLowerCase().endsWith('.zip')){const archive=await unzipper.Open.buffer(file.buffer);const workbook=archive.files.find(entry=>this.normalizePath(entry.path)==='catalog.xlsx');
      if(!workbook)throw new BadRequestException('ZIP archive must contain catalog.xlsx');workbookBuffer=await workbook.buffer();for(const entry of archive.files)if(entry.type==='File'&&this.normalizePath(entry.path).startsWith('images/'))images.set(this.normalizePath(entry.path),await entry.buffer());}
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(workbookBuffer as never);return{workbook,images,hash,fileName:file.originalname};}

  private async buildReport(parsed:ParsedImport):Promise<ImportReport>{const sheets:Record<string,ImportRow[]>={};const errors:ImportIssue[]=[];const warnings:ImportIssue[]=[];
    for(const[name,columns]of Object.entries(SHEETS)){const sheet=parsed.workbook.getWorksheet(name);if(!sheet){errors.push({sheet:name,row:0,field:'sheet',message:`Missing sheet ${name}`,severity:'error'});sheets[name]=[];continue;}
      const headers=(sheet.getRow(1).values as unknown[]).map(value=>String(value??'').trim());const missing=columns.filter(column=>!headers.includes(column));for(const field of missing)errors.push({sheet:name,row:1,field,message:`Missing column ${field}`,severity:'error'});
      const rows:ImportRow[]=[];sheet.eachRow((row,rowNumber)=>{if(rowNumber===1)return;const record={} as ImportRow;for(let index=1;index<headers.length;index++)if(headers[index])record[headers[index]]=this.cell(row.getCell(index).value);record._row=String(rowNumber);
        if(Object.entries(record).some(([key,value])=>key!=='_row'&&value!==''))rows.push(record);});sheets[name]=rows;}
    const required:Record<string,string[]>={Categories:['external_key','title_ar','slug'],Products:['external_key','primary_category_key','title_ar','slug'],Models:['product_key','model_code'],SpecificationDefinitions:['slug','name_ar','type'],CategorySpecifications:['category_key','specification_slug'],ModelSpecifications:['product_key','model_code','specification_slug'],ProductImages:['product_key','image_path_or_url'],ModelImages:['product_key','model_code','image_path_or_url']};
    for(const[sheet,fields]of Object.entries(required))for(const row of sheets[sheet]??[])for(const field of fields)if(!row[field])errors.push(this.issue(sheet,row,field,`${field} is required`));
    this.duplicates(sheets.Categories,'external_key',errors);this.duplicates(sheets.Products,'external_key',errors);this.duplicates(sheets.SpecificationDefinitions,'slug',errors);
    this.duplicates(sheets.Models,row=>`${row.product_key}:${row.model_code}`,errors);this.duplicates(sheets.ModelSpecifications,row=>`${row.product_key}:${row.model_code}:${row.specification_slug}`,errors);
    const existing=await this.existingKeys();const categories=new Set([...existing.categories,...sheets.Categories.map(row=>row.external_key)]),products=new Set([...existing.products,...sheets.Products.map(row=>row.external_key)]),specifications=new Set([...existing.specifications,...sheets.SpecificationDefinitions.map(row=>row.slug)]);
    const models=new Set([...existing.models,...sheets.Models.map(row=>`${row.product_key}:${row.model_code}`)]);
    for(const row of sheets.Categories)if(row.parent_external_key&&!categories.has(row.parent_external_key))errors.push(this.issue('Categories',row,'parent_external_key','Parent category does not exist'));
    for(const row of sheets.Products){if(!categories.has(row.primary_category_key))errors.push(this.issue('Products',row,'primary_category_key','Category does not exist'));if(row.brand_key&&!existing.brands.has(row.brand_key))errors.push(this.issue('Products',row,'brand_key','Brand does not exist'));}
    for(const row of sheets.Models)if(!products.has(row.product_key))errors.push(this.issue('Models',row,'product_key','Product does not exist'));
    for(const row of sheets.CategorySpecifications){if(!categories.has(row.category_key))errors.push(this.issue('CategorySpecifications',row,'category_key','Category does not exist'));if(!specifications.has(row.specification_slug))errors.push(this.issue('CategorySpecifications',row,'specification_slug','Specification does not exist'));}
    for(const row of sheets.ModelSpecifications){if(!models.has(`${row.product_key}:${row.model_code}`))errors.push(this.issue('ModelSpecifications',row,'model_code','Model does not exist'));if(!specifications.has(row.specification_slug))errors.push(this.issue('ModelSpecifications',row,'specification_slug','Specification does not exist'));}
    for(const sheet of ['ProductImages','ModelImages'])for(const row of sheets[sheet]){const path=row.image_path_or_url;if(!this.isUrl(path)&&!parsed.images.has(this.normalizePath(path)))errors.push(this.issue(sheet,row,'image_path_or_url','Image is missing from ZIP archive'));}
    const summary=Object.fromEntries(Object.entries(sheets).map(([name,rows])=>[name,rows.length]));summary.errors=errors.length;summary.warnings=warnings.length;return{summary,errors,warnings,sheets};}

  private async executeRows(db:DbExecutor,report:ImportReport,assets:Map<string,{id:string;public_url:string}>):Promise<void>{const ids=await this.loadIds(db);
    const pending=[...report.sheets.Categories];while(pending.length){let progressed=false;for(let i=pending.length-1;i>=0;i--){const row=pending[i],parentId=row.parent_external_key?ids.categories.get(row.parent_external_key):null;if(row.parent_external_key&&!parentId)continue;
      const result=await db.query<{id:string}>(`INSERT INTO categories(external_key,parent_id,catalog_code,title_ar,title_en,slug) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(external_key) DO UPDATE SET parent_id=EXCLUDED.parent_id,catalog_code=EXCLUDED.catalog_code,title_ar=EXCLUDED.title_ar,title_en=EXCLUDED.title_en,slug=EXCLUDED.slug,updated_at=NOW() RETURNING id`,
        [row.external_key,parentId,row.catalog_code||null,row.title_ar,row.title_en||null,row.slug]);ids.categories.set(row.external_key,result.rows[0].id);pending.splice(i,1);progressed=true;}if(!progressed)throw new BadRequestException('Category hierarchy contains an unresolved cycle');}
    for(const row of report.sheets.SpecificationDefinitions){const result=await db.query<{id:string}>(`INSERT INTO specification_definitions(slug,name_ar,name_en,value_type,unit_ar,unit_en,is_filterable,is_comparable)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(slug) DO UPDATE SET name_ar=EXCLUDED.name_ar,name_en=EXCLUDED.name_en,value_type=EXCLUDED.value_type,
      unit_ar=EXCLUDED.unit_ar,unit_en=EXCLUDED.unit_en,is_filterable=EXCLUDED.is_filterable,is_comparable=EXCLUDED.is_comparable,updated_at=NOW() RETURNING id`,
      [row.slug,row.name_ar,row.name_en||null,row.type,row.unit_ar||null,row.unit_en||null,this.bool(row.filterable),this.bool(row.comparable,true)]);ids.specifications.set(row.slug,result.rows[0].id);}
    for(const row of report.sheets.Products){const result=await db.query<{id:string}>(`INSERT INTO products(external_key,primary_category_id,brand_id,title_ar,title_en,slug,status)
      VALUES($1,$2,$3,$4,$5,$6,'draft') ON CONFLICT(external_key) DO UPDATE SET primary_category_id=EXCLUDED.primary_category_id,brand_id=EXCLUDED.brand_id,
      title_ar=EXCLUDED.title_ar,title_en=EXCLUDED.title_en,slug=EXCLUDED.slug,updated_at=NOW() RETURNING id`,[row.external_key,ids.categories.get(row.primary_category_key),row.brand_key?ids.brands.get(row.brand_key):null,row.title_ar,row.title_en||null,row.slug]);ids.products.set(row.external_key,result.rows[0].id);}
    for(const row of report.sheets.Models){const productId=ids.products.get(row.product_key)!;if(this.bool(row.default))await db.query('UPDATE product_models SET is_default=FALSE WHERE product_id=$1',[productId]);const result=await db.query<{id:string}>(`INSERT INTO product_models(product_id,model_code,sku,availability_status,unit_of_measure,minimum_request_quantity,maximum_request_quantity,quantity_step,is_default)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(product_id,model_code) DO UPDATE SET sku=EXCLUDED.sku,availability_status=EXCLUDED.availability_status,
      unit_of_measure=EXCLUDED.unit_of_measure,minimum_request_quantity=EXCLUDED.minimum_request_quantity,maximum_request_quantity=EXCLUDED.maximum_request_quantity,
      quantity_step=EXCLUDED.quantity_step,is_default=EXCLUDED.is_default,updated_at=NOW() RETURNING id`,[productId,row.model_code,row.sku||null,row.availability||'available',row.unit||'piece',this.num(row.minimum,1),row.maximum?this.num(row.maximum):null,this.num(row.step,1),this.bool(row.default)]);ids.models.set(`${row.product_key}:${row.model_code}`,result.rows[0].id);}
    for(const row of report.sheets.CategorySpecifications)await db.query(`INSERT INTO category_specifications(category_id,specification_id,is_required,is_filterable_override,is_comparable_override,sort_order)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(category_id,specification_id) DO UPDATE SET is_required=EXCLUDED.is_required,is_filterable_override=EXCLUDED.is_filterable_override,
      is_comparable_override=EXCLUDED.is_comparable_override,sort_order=EXCLUDED.sort_order`,[ids.categories.get(row.category_key),ids.specifications.get(row.specification_slug),this.bool(row.required),row.filterable?this.bool(row.filterable):null,row.comparable?this.bool(row.comparable):null,this.num(row.sort_order,0)]);
    for(const row of report.sheets.ModelSpecifications){const modelId=ids.models.get(`${row.product_key}:${row.model_code}`)!,specificationId=ids.specifications.get(row.specification_slug)!;let optionId:string|null=null;if(row.option_key){const option=await db.query<{id:string}>('SELECT id FROM specification_options WHERE specification_id=$1 AND value_key=$2',[specificationId,row.option_key]);if(!option.rows[0])throw new BadRequestException(`Unknown option ${row.option_key}`);optionId=option.rows[0].id;}
      await db.query(`INSERT INTO product_model_specification_values(model_id,specification_id,value_text_ar,value_text_en,value_number,value_number_to,option_id,display_value_ar,display_value_en)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(model_id,specification_id) DO UPDATE SET value_text_ar=EXCLUDED.value_text_ar,value_text_en=EXCLUDED.value_text_en,
        value_number=EXCLUDED.value_number,value_number_to=EXCLUDED.value_number_to,option_id=EXCLUDED.option_id,display_value_ar=EXCLUDED.display_value_ar,display_value_en=EXCLUDED.display_value_en`,
        [modelId,specificationId,row.value_text_ar||null,row.value_text_en||null,row.value_number?this.num(row.value_number):null,row.value_number_to?this.num(row.value_number_to):null,optionId,row.value_text_ar||row.value_number||null,row.value_text_en||row.value_number||null]);}
    for(const row of report.sheets.ProductImages){const asset=assets.get(this.normalizePath(row.image_path_or_url));await db.query(`INSERT INTO product_images(product_id,media_asset_id,image_url,alt_text_ar,alt_text_en,is_primary,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [ids.products.get(row.product_key),asset?.id??null,asset?.public_url??row.image_path_or_url,row.alt_ar||null,row.alt_en||null,this.bool(row.primary),this.num(row.sort_order,0)]);}
    for(const row of report.sheets.ModelImages){const asset=assets.get(this.normalizePath(row.image_path_or_url));await db.query(`INSERT INTO product_model_images(model_id,media_asset_id,image_url,alt_text_ar,alt_text_en,is_primary,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [ids.models.get(`${row.product_key}:${row.model_code}`),asset?.id??null,asset?.public_url??row.image_path_or_url,row.alt_ar||null,row.alt_en||null,this.bool(row.primary),this.num(row.sort_order,0)]);}}

  private async existingKeys():Promise<{categories:Set<string>;products:Set<string>;specifications:Set<string>;brands:Set<string>;models:Set<string>}>{const[c,p,s,b,m]=await Promise.all([
    this.database.query<{external_key:string}>('SELECT external_key FROM categories WHERE external_key IS NOT NULL'),this.database.query<{external_key:string}>('SELECT external_key FROM products WHERE external_key IS NOT NULL'),
    this.database.query<{slug:string}>('SELECT slug FROM specification_definitions'),this.database.query<{external_key:string}>('SELECT external_key FROM brands WHERE external_key IS NOT NULL'),
    this.database.query<{key:string}>(`SELECT p.external_key||':'||m.model_code AS key FROM product_models m JOIN products p ON p.id=m.product_id WHERE p.external_key IS NOT NULL`)]);
    return{categories:new Set(c.rows.map(row=>row.external_key)),products:new Set(p.rows.map(row=>row.external_key)),specifications:new Set(s.rows.map(row=>row.slug)),brands:new Set(b.rows.map(row=>row.external_key)),models:new Set(m.rows.map(row=>row.key))};}
  private async loadIds(db:DbExecutor):Promise<{categories:Map<string,string>;products:Map<string,string>;specifications:Map<string,string>;brands:Map<string,string>;models:Map<string,string>}>{const[c,p,s,b,m]=await Promise.all([
    db.query<{id:string;key:string}>('SELECT id,external_key AS key FROM categories WHERE external_key IS NOT NULL'),db.query<{id:string;key:string}>('SELECT id,external_key AS key FROM products WHERE external_key IS NOT NULL'),
    db.query<{id:string;key:string}>('SELECT id,slug AS key FROM specification_definitions'),db.query<{id:string;key:string}>('SELECT id,external_key AS key FROM brands WHERE external_key IS NOT NULL'),
    db.query<{id:string;key:string}>(`SELECT m.id,p.external_key||':'||m.model_code AS key FROM product_models m JOIN products p ON p.id=m.product_id WHERE p.external_key IS NOT NULL`)]);
    const map=(rows:{id:string;key:string}[])=>new Map(rows.map(row=>[row.key,row.id]));return{categories:map(c.rows),products:map(p.rows),specifications:map(s.rows),brands:map(b.rows),models:map(m.rows)};}
  private archivePaths(report:ImportReport):Set<string>{const values=[...report.sheets.ProductImages,...report.sheets.ModelImages].map(row=>row.image_path_or_url).filter(path=>!this.isUrl(path));return new Set(values);}
  private duplicates(rows:ImportRow[],key:string|((row:ImportRow)=>string),errors:ImportIssue[]):void{const seen=new Set<string>();for(const row of rows){const value=typeof key==='string'?row[key]:key(row);if(value&&seen.has(value))errors.push(this.issue('Import',row,typeof key==='string'?key:'key',`Duplicate key ${value}`));seen.add(value);}}
  private issue(sheet:string,row:ImportRow,field:string,message:string):ImportIssue{return{sheet,row:Number(row._row),field,message,severity:'error'};}
  private cell(value:ExcelJS.CellValue):string{if(value===null||value===undefined)return'';if(typeof value==='object'&&'text'in value)return String(value.text).trim();if(typeof value==='object'&&'result'in value)return String(value.result??'').trim();return String(value).trim();}
  private normalizePath(value:string):string{return value.replaceAll('\\','/').replace(/^\.\//,'').toLowerCase();}
  private isUrl(value:string):boolean{return /^https?:\/\//i.test(value);}
  private bool(value:string,fallback=false):boolean{return value===''?fallback:['true','1','yes','y','نعم'].includes(value.toLowerCase());}
  private num(value:string,fallback?:number):number{if(value===''){if(fallback!==undefined)return fallback;throw new BadRequestException('Numeric value is required');}const number=Number(value);if(!Number.isFinite(number))throw new BadRequestException(`Invalid number ${value}`);return number;}
}
