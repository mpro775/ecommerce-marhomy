import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { QUOTE_STATUSES } from '../common/domain/quote-rules';
export class SubmitQuoteRequestDto{
  @IsString()@MaxLength(100)cartToken!:string;
  @IsString()@MaxLength(200)fullName!:string;
  @IsString()@Matches(/^\+?[0-9\s()-]{7,24}$/)phone!:string;
  @IsOptional()@IsEmail()email?:string;
  @IsOptional()@IsString()@MaxLength(255)companyName?:string;
  @IsOptional()@IsString()@MaxLength(150)city?:string;
  @IsOptional()@IsString()@MaxLength(1000)addressText?:string;
  @IsOptional()@IsString()@MaxLength(1000)deliveryNotes?:string;
  @IsOptional()@IsIn(['phone','email','whatsapp'])preferredContactMethod?:string;
  @IsOptional()@IsString()@MaxLength(3000)customerNote?:string;
  @IsOptional()@IsString()@MaxLength(30)source?:string;
  @IsISO8601()formStartedAt!:string;
  @IsOptional()@IsString()@MaxLength(100)website?:string;
}
export class ListQuoteRequestsQuery{
  @IsOptional()@IsIn(QUOTE_STATUSES)status?:string;
  @IsOptional()@IsString()@MaxLength(100)search?:string;
  @IsOptional()@IsUUID()assigneeId?:string;
  @IsOptional()@IsInt()@Min(1)@Type(()=>Number)page?:number;
  @IsOptional()@IsInt()@Min(1)@Max(100)@Type(()=>Number)pageSize?:number;
}
export class UpdateQuoteStatusDto{
  @IsIn(QUOTE_STATUSES)status!:typeof QUOTE_STATUSES[number];
  @IsOptional()@IsString()@MaxLength(1000)note?:string;
}
export class UpdateAssigneeDto{@IsOptional()@IsUUID()adminUserId?:string;}
export class CreateQuoteNoteDto{@IsString()@MaxLength(3000)content!:string;}
export class UpdateContactDto{
  @IsOptional()@IsString()@MaxLength(200)fullName?:string;
  @IsOptional()@IsEmail()email?:string;
  @IsOptional()@IsString()@MaxLength(255)companyName?:string;
  @IsOptional()@IsString()@MaxLength(150)city?:string;
  @IsOptional()@IsIn(['phone','email','whatsapp'])preferredContactMethod?:string;
}
