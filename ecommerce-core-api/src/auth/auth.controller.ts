import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto';
import { AccessTokenGuard } from './access-token.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthResult, AuthUser } from './auth.types';
import { getRequestContext } from '../common/utils/request-context';
@Controller('auth')
export class AuthController{
  constructor(private readonly auth:AuthService){}
  @Post('login')@Throttle({default:{limit:5,ttl:60000}})
  login(@Body()body:LoginDto,@Req()request:Request):Promise<AuthResult>{return this.auth.login(body.email,body.password,getRequestContext(request));}
  @Post('refresh')refresh(@Body()body:RefreshDto,@Req()request:Request):Promise<AuthResult>{return this.auth.refresh(body.refreshToken,getRequestContext(request));}
  @Post('logout')@HttpCode(204)@UseGuards(AccessTokenGuard)
  logout(@CurrentUser()user:AuthUser,@Req()request:Request):Promise<void>{return this.auth.logout(user,getRequestContext(request));}
  @Get('me')@UseGuards(AccessTokenGuard)me(@CurrentUser()user:AuthUser):AuthUser{return user;}
}
