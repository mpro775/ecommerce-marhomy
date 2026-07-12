import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
export class UpsertCatalogEntryDto{
  @IsOptional()@IsUUID()parentId?:string|null;
  @IsOptional()@IsString()@MaxLength(255)titleAr?:string;
  @IsOptional()@IsString()@MaxLength(255)titleEn?:string;
  @IsString()@MaxLength(255)slug!:string;
  @IsOptional()@IsString()descriptionAr?:string;
  @IsOptional()@IsString()descriptionEn?:string;
  @IsOptional()@IsString()imageUrl?:string;
  @IsOptional()@IsString()logoUrl?:string;
  @IsOptional()@IsString()@MaxLength(255)seoTitleAr?:string;
  @IsOptional()@IsString()@MaxLength(255)seoTitleEn?:string;
  @IsOptional()@IsString()seoDescriptionAr?:string;
  @IsOptional()@IsString()seoDescriptionEn?:string;
  @IsOptional()@IsString()@MaxLength(150)nameAr?:string;
  @IsOptional()@IsString()@MaxLength(150)nameEn?:string;
  @IsOptional()@IsIn(['select','text','number','color'])inputType?:string;
  @IsOptional()@IsIn(['option','range'])filterType?:string;
  @IsOptional()@IsBoolean()isFilterable?:boolean;
  @IsOptional()@IsBoolean()isActive?:boolean;
  @IsOptional()@IsInt()@Min(0)sortOrder?:number;
}
export class CreateCatalogValueDto{
  @IsString()@MaxLength(150)valueAr!:string;
  @IsOptional()@IsString()@MaxLength(150)valueEn?:string;
  @IsOptional()@IsString()@MaxLength(100)code?:string;
  @IsOptional()@IsInt()@Min(0)sortOrder?:number;
}
export class UpdateCatalogValueDto extends CreateCatalogValueDto{}
export class UpdateCategoryAttributesDto{
  @IsArray()@IsUUID('4',{each:true})attributeIds!:string[];
}
