import { IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
export class CreateQuoteCartDto{
  @IsOptional()@IsString()@MaxLength(100)visitorId?:string;
}
export class AddQuoteCartItemDto{
  @IsUUID()productId!:string;
  @IsOptional()@IsUUID()variantId?:string;
  @IsNumber({maxDecimalPlaces:3})@Min(0.001)quantity!:number;
  @IsOptional()@IsObject()selectedOptions?:Record<string,string>;
  @IsOptional()@IsString()@MaxLength(1000)itemNote?:string;
}
export class UpdateQuoteCartItemDto{
  @IsNumber({maxDecimalPlaces:3})@Min(0.001)quantity!:number;
  @IsOptional()@IsString()@MaxLength(1000)itemNote?:string;
}
