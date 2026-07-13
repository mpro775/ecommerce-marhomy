import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

export class CreateCategoryDto {
  @IsOptional() @IsUUID() parentId?:string|null;
  @IsOptional() @IsString() @MaxLength(120) externalKey?:string|null;
  @IsOptional() @IsString() @MaxLength(50) catalogCode?:string|null;
  @IsString() @MaxLength(255) titleAr!:string;
  @IsOptional() @IsString() @MaxLength(255) titleEn?:string|null;
  @IsString() @MaxLength(255) slug!:string;
  @IsOptional() @IsString() descriptionAr?:string|null;
  @IsOptional() @IsString() descriptionEn?:string|null;
  @IsOptional() @IsString() imageUrl?:string|null;
  @IsOptional() @IsString() @MaxLength(100) iconKey?:string|null;
  @IsOptional() @IsBoolean() isActive?:boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?:number;
}
export class UpdateCategoryDto extends PartialType(CreateCategoryDto){}

export class CreateBrandDto {
  @IsOptional() @IsString() @MaxLength(120) externalKey?:string|null;
  @IsString() @MaxLength(255) titleAr!:string;
  @IsOptional() @IsString() @MaxLength(255) titleEn?:string|null;
  @IsString() @MaxLength(255) slug!:string;
  @IsOptional() @IsString() descriptionAr?:string|null;
  @IsOptional() @IsString() descriptionEn?:string|null;
  @IsOptional() @IsString() logoUrl?:string|null;
  @IsOptional() @IsBoolean() isActive?:boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?:number;
}
export class UpdateBrandDto extends PartialType(CreateBrandDto){}

export class SpecificationOptionDto {
  @IsOptional() @IsUUID() id?:string;
  @IsString() @MaxLength(120) valueKey!:string;
  @IsString() @MaxLength(150) labelAr!:string;
  @IsOptional() @IsString() @MaxLength(150) labelEn?:string|null;
  @IsOptional() @IsInt() @Min(0) sortOrder?:number;
  @IsOptional() @IsBoolean() isActive?:boolean;
}
export class CreateSpecificationDto {
  @IsString() @MaxLength(150) slug!:string;
  @IsString() @MaxLength(150) nameAr!:string;
  @IsOptional() @IsString() @MaxLength(150) nameEn?:string|null;
  @IsIn(['text','number','range','option','boolean']) valueType!:string;
  @IsOptional() @IsString() @MaxLength(50) unitAr?:string|null;
  @IsOptional() @IsString() @MaxLength(50) unitEn?:string|null;
  @IsOptional() @IsBoolean() isRequiredDefault?:boolean;
  @IsOptional() @IsBoolean() isFilterable?:boolean;
  @IsOptional() @IsBoolean() isComparable?:boolean;
  @IsOptional() @IsBoolean() isActive?:boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?:number;
  @IsOptional() @IsArray() @ValidateNested({each:true}) @Type(()=>SpecificationOptionDto) options?:SpecificationOptionDto[];
}
export class UpdateSpecificationDto extends PartialType(CreateSpecificationDto){}

export class CategorySpecificationDto {
  @IsUUID() specificationId!:string;
  @IsOptional() @IsBoolean() isRequired?:boolean;
  @IsOptional() @IsBoolean() isFilterableOverride?:boolean|null;
  @IsOptional() @IsBoolean() isComparableOverride?:boolean|null;
  @IsOptional() @IsInt() @Min(0) sortOrder?:number;
}
export class ReplaceCategorySpecificationsDto {
  @IsArray() @ValidateNested({each:true}) @Type(()=>CategorySpecificationDto) values!:CategorySpecificationDto[];
}
export class ReorderCategoriesDto {@IsArray() @IsUUID('4',{each:true}) categoryIds!:string[];}
