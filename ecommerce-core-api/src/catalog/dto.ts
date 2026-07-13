import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
export class UpsertCatalogEntryDto{
  @IsOptional()@IsUUID()parentId?:string|null;
  @IsOptional()@IsString()@MaxLength(255)titleAr?:string;
  @IsOptional()@IsString()@MaxLength(255)titleEn?:string;
  @IsString()@MaxLength(255)slug!:string;
  @IsOptional()@IsString()descriptionAr?:string|null;
  @IsOptional()@IsString()descriptionEn?:string|null;
  @IsOptional()@IsString()imageUrl?:string|null;
  @IsOptional()@IsString()logoUrl?:string|null;
  @IsOptional()@IsString()@MaxLength(255)seoTitleAr?:string|null;
  @IsOptional()@IsString()@MaxLength(255)seoTitleEn?:string|null;
  @IsOptional()@IsString()seoDescriptionAr?:string|null;
  @IsOptional()@IsString()seoDescriptionEn?:string|null;
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
export class UpdateCatalogValueDto extends PartialType(CreateCatalogValueDto){}
export class UpdateCatalogEntryDto extends PartialType(UpsertCatalogEntryDto){}
export class UpdateCategoryAttributesDto{
  @IsArray()@IsUUID('4',{each:true})attributeIds!:string[];
}
