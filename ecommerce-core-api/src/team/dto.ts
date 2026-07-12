import { ArrayMinSize, IsArray, IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
export class InviteAdminDto{
  @IsEmail()email!:string;
  @IsString()@MaxLength(200)fullName!:string;
  @IsString()roleName!:string;
}
export class AcceptInviteDto{
  @IsString()@MinLength(30)token!:string;
  @IsString()@MinLength(10)password!:string;
}
export class RequestPasswordResetDto{@IsEmail()email!:string;}
export class ResetPasswordDto{
  @IsString()@MinLength(30)token!:string;
  @IsString()@MinLength(10)password!:string;
}
export class UpdateAdminDto{
  @IsOptional()@IsBoolean()isActive?:boolean;
  @IsOptional()@IsArray()@ArrayMinSize(1)@IsString({each:true})roles?:string[];
}
