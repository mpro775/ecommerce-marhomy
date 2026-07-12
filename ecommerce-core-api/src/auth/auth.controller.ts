import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto';
import { AccessTokenGuard } from './access-token.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthResult, AuthUser } from './auth.types';
import { getRequestContext } from '../common/utils/request-context';
@Controller('auth')
export class AuthController{
  private readonly cookieName='rfq_admin_refresh';
  constructor(private readonly auth:AuthService,private readonly config:ConfigService){}
  @Post('login')@Throttle({default:{limit:5,ttl:60000}})
  async login(@Body()body:LoginDto,@Req()request:Request,@Res({passthrough:true})response:Response):Promise<AuthResult>{
    const result=await this.auth.login(body.email,body.password,getRequestContext(request));return this.toCookieResponse(result,response);
  }
  @Post('refresh')@Throttle({default:{limit:30,ttl:60000}})
  async refresh(@Req()request:Request,@Res({passthrough:true})response:Response):Promise<AuthResult>{
    const token=this.readCookie(request,this.cookieName);if(!token)throw new UnauthorizedException('Refresh cookie is required');
    return this.toCookieResponse(await this.auth.refresh(token,getRequestContext(request)),response);
  }
  @Post('logout')@HttpCode(204)@UseGuards(AccessTokenGuard)
  async logout(@CurrentUser()user:AuthUser,@Req()request:Request,@Res({passthrough:true})response:Response):Promise<void>{
    await this.auth.logout(user,getRequestContext(request));this.clearCookie(response);
  }
  @Get('me')@UseGuards(AccessTokenGuard)me(@CurrentUser()user:AuthUser):AuthUser{return user;}
  private toCookieResponse(result:AuthResult&{refreshToken:string},response:Response):AuthResult{
    response.setHeader('Cache-Control','no-store');
    response.cookie(this.cookieName,result.refreshToken,{httpOnly:true,secure:this.config.get<string>('NODE_ENV')==='production',
      sameSite:'strict',path:'/api/auth',maxAge:this.config.get<number>('REFRESH_TOKEN_TTL_DAYS',30)*86400000});
    const{refreshToken:unused,...body}=result;void unused;return body;
  }
  private clearCookie(response:Response):void{response.clearCookie(this.cookieName,{httpOnly:true,
    secure:this.config.get<string>('NODE_ENV')==='production',sameSite:'strict',path:'/api/auth'});}
  private readCookie(request:Request,name:string):string|undefined{
    for(const part of (request.headers.cookie??'').split(';')){const[indexName,...rest]=part.trim().split('=');
      if(indexName===name){try{return decodeURIComponent(rest.join('='));}catch{return undefined;}}}return undefined;
  }
}
