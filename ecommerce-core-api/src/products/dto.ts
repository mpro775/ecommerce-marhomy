import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
const units=['piece','box','carton','meter','kilogram','gram','liter','set','roll','pack'] as const;
export class ProductImageDto{
  @IsUrl({require_tld:false})imageUrl!:string;
  @IsOptional()@IsString()@MaxLength(255)altTextAr?:string;
  @IsOptional()@IsString()@MaxLength(255)altTextEn?:string;
  @IsOptional()@IsBoolean()isPrimary?:boolean;
  @IsOptional()@IsInt()@Min(0)sortOrder?:number;
}
export class ProductVariantDto{
  @IsString()@MaxLength(255)titleAr!:string;
  @IsOptional()@IsString()@MaxLength(255)titleEn?:string;
  @IsOptional()@IsString()@MaxLength(100)sku?:string;
  @IsOptional()@IsString()@MaxLength(100)barcode?:string;
  @IsOptional()@IsObject()attributes?:Record<string,string>;
  @IsOptional()@IsBoolean()isDefault?:boolean;
  @IsOptional()@IsBoolean()isActive?:boolean;
  @IsOptional()@IsInt()@Min(0)sortOrder?:number;
}
export class ProductFilterRangeDto{
  @IsUUID()filterId!:string;
  @IsNumber({maxDecimalPlaces:3})value!:number;
}
export class CreateProductDto{
  @IsOptional()@IsUUID()categoryId?:string;
  @IsOptional()@IsUUID()brandId?:string;
  @IsString()@MaxLength(255)titleAr!:string;
  @IsOptional()@IsString()@MaxLength(255)titleEn?:string;
  @IsString()@MaxLength(255)slug!:string;
  @IsOptional()@IsString()shortDescriptionAr?:string;
  @IsOptional()@IsString()shortDescriptionEn?:string;
  @IsOptional()@IsString()detailedDescriptionAr?:string;
  @IsOptional()@IsString()detailedDescriptionEn?:string;
  @IsOptional()@IsString()@MaxLength(100)modelCode?:string;
  @IsOptional()@IsString()@MaxLength(100)sku?:string;
  @IsOptional()@IsString()@MaxLength(100)barcode?:string;
  @IsOptional()@IsUrl({require_tld:false})youtubeUrl?:string;
  @IsOptional()@IsArray()@IsString({each:true})tags?:string[];
  @IsOptional()@IsBoolean()isFeatured?:boolean;
  @IsOptional()@IsIn(['draft','published','archived'])status?:string;
  @IsOptional()@IsInt()@Min(0)sortOrder?:number;
  @IsOptional()@IsString()seoTitleAr?:string;
  @IsOptional()@IsString()seoTitleEn?:string;
  @IsOptional()@IsString()seoDescriptionAr?:string;
  @IsOptional()@IsString()seoDescriptionEn?:string;
  @IsOptional()@IsBoolean()quoteEnabled?:boolean;
  @IsOptional()@IsIn(['available','on_request','temporarily_unavailable','discontinued'])availabilityStatus?:string;
  @IsOptional()@IsIn(units)unitOfMeasure?:string;
  @IsOptional()@IsNumber({maxDecimalPlaces:3})@Min(0.001)minimumRequestQuantity?:number;
  @IsOptional()@IsNumber({maxDecimalPlaces:3})@Min(0.001)maximumRequestQuantity?:number;
  @IsOptional()@IsNumber({maxDecimalPlaces:3})@Min(0.001)quantityStep?:number;
  @IsOptional()@IsObject()specifications?:Record<string,string|number|boolean>;
  @IsOptional()@IsArray()@ValidateNested({each:true})@Type(()=>ProductImageDto)images?:ProductImageDto[];
  @IsOptional()@IsArray()@ValidateNested({each:true})@Type(()=>ProductVariantDto)variants?:ProductVariantDto[];
  @IsOptional()@IsArray()@IsUUID('4',{each:true})relatedProductIds?:string[];
  @IsOptional()@IsArray()@IsUUID('4',{each:true})extraCategoryIds?:string[];
  @IsOptional()@IsArray()@IsUUID('4',{each:true})filterValueIds?:string[];
  @IsOptional()@IsArray()@ValidateNested({each:true})@Type(()=>ProductFilterRangeDto)filterRanges?:ProductFilterRangeDto[];
}
export class UpdateProductDto extends CreateProductDto{}
export class ListProductsQuery{
  @IsOptional()@IsString()search?:string;
  @IsOptional()@IsString()category?:string;
  @IsOptional()@IsString()brand?:string;
  @IsOptional()@IsBoolean()@Type(()=>Boolean)featured?:boolean;
  @IsOptional()@IsString()filterValues?:string;
  @IsOptional()@IsInt()@Min(1)@Type(()=>Number)page?:number;
  @IsOptional()@IsInt()@Min(1)@Max(100)@Type(()=>Number)pageSize?:number;
}
