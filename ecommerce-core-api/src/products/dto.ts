import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUrl, IsUUID,
  Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

export const availabilityStatuses = ['available','available_on_request','out_of_stock','discontinued','hidden'] as const;

export class ProductImageDto {
  @IsOptional() @IsUUID() id?: string;
  @IsOptional() @IsUUID() mediaAssetId?: string | null;
  @IsUrl({ require_tld: false }) imageUrl!: string;
  @IsOptional() @IsString() @MaxLength(255) altTextAr?: string | null;
  @IsOptional() @IsString() @MaxLength(255) altTextEn?: string | null;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
export class UpdateProductImageDto extends PartialType(ProductImageDto) {}

export class CreateProductDto {
  @IsUUID() primaryCategoryId!: string;
  @IsOptional() @IsUUID() brandId?: string | null;
  @IsOptional() @IsString() @MaxLength(120) externalKey?: string | null;
  @IsString() @MaxLength(255) titleAr!: string;
  @IsOptional() @IsString() @MaxLength(255) titleEn?: string | null;
  @IsString() @MaxLength(255) slug!: string;
  @IsOptional() @IsString() shortDescriptionAr?: string | null;
  @IsOptional() @IsString() shortDescriptionEn?: string | null;
  @IsOptional() @IsString() descriptionAr?: string | null;
  @IsOptional() @IsString() descriptionEn?: string | null;
  @IsOptional() @IsUrl({ require_tld: false }) videoUrl?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsIn(['draft','published','archived']) status?: string;
  @IsOptional() @IsBoolean() quoteEnabled?: boolean;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsString() @MaxLength(255) seoTitleAr?: string | null;
  @IsOptional() @IsString() @MaxLength(255) seoTitleEn?: string | null;
  @IsOptional() @IsString() seoDescriptionAr?: string | null;
  @IsOptional() @IsString() seoDescriptionEn?: string | null;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductImageDto) images?: ProductImageDto[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) extraCategoryIds?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) relatedProductIds?: string[];
}
export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ListProductsQuery {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) featured?: boolean;
  @IsOptional() @IsString() filters?: string;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) pageSize?: number;
}

export class ModelSpecificationValueDto {
  @IsUUID() specificationId!: string;
  @IsOptional() @IsString() valueTextAr?: string | null;
  @IsOptional() @IsString() valueTextEn?: string | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 4 }) valueNumber?: number | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 4 }) valueNumberTo?: number | null;
  @IsOptional() @IsBoolean() valueBoolean?: boolean | null;
  @IsOptional() @IsUUID() optionId?: string | null;
  @IsOptional() @IsString() displayValueAr?: string | null;
  @IsOptional() @IsString() displayValueEn?: string | null;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class CreateProductModelDto {
  @IsString() @MaxLength(120) modelCode!: string;
  @IsOptional() @IsString() @MaxLength(255) titleAr?: string | null;
  @IsOptional() @IsString() @MaxLength(255) titleEn?: string | null;
  @IsOptional() @IsString() shortDescriptionAr?: string | null;
  @IsOptional() @IsString() shortDescriptionEn?: string | null;
  @IsOptional() @IsString() descriptionAr?: string | null;
  @IsOptional() @IsString() descriptionEn?: string | null;
  @IsOptional() @IsString() @MaxLength(120) sku?: string | null;
  @IsOptional() @IsString() @MaxLength(120) barcode?: string | null;
  @IsOptional() @IsIn(availabilityStatuses) availabilityStatus?: string;
  @IsOptional() @IsBoolean() quoteEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(40) unitOfMeasure?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) minimumRequestQuantity?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) maximumRequestQuantity?: number | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) quantityStep?: number;
  @IsOptional() @IsUrl({ require_tld: false }) datasheetUrl?: string | null;
  @IsOptional() @IsUrl({ require_tld: false }) manualUrl?: string | null;
  @IsOptional() @IsUrl({ require_tld: false }) videoUrl?: string | null;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductImageDto) images?: ProductImageDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ModelSpecificationValueDto) specifications?: ModelSpecificationValueDto[];
}
export class UpdateProductModelDto extends PartialType(CreateProductModelDto) {}

export class ReorderModelsDto {
  @IsArray() @IsUUID('4', { each: true }) modelIds!: string[];
}
export class BulkModelStatusDto {
  @IsArray() @IsUUID('4', { each: true }) modelIds!: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsIn(availabilityStatuses) availabilityStatus?: string;
  @IsOptional() @IsBoolean() quoteEnabled?: boolean;
}
export class DuplicateModelDto {
  @IsString() @MaxLength(120) modelCode!: string;
  @IsOptional() @IsString() @MaxLength(120) sku?: string | null;
  @IsOptional() @IsBoolean() copyImages?: boolean;
}

export class ReorderImagesDto {
  @IsArray() @IsUUID('4', { each: true }) imageIds!: string[];
}

export class ReplaceModelSpecificationsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ModelSpecificationValueDto)
  values!: ModelSpecificationValueDto[];
}
