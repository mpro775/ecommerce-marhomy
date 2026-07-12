import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './access-token.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
@Module({
  imports:[JwtModule.registerAsync({inject:[ConfigService],useFactory:(config:ConfigService)=>({
    secret:config.getOrThrow<string>('JWT_ACCESS_SECRET'),signOptions:{expiresIn:config.get<string>('JWT_ACCESS_EXPIRES_IN','15m') as never}})})],
  controllers:[AuthController],providers:[AuthRepository,AuthService,AccessTokenGuard,PermissionsGuard],
  exports:[AuthService,AccessTokenGuard,PermissionsGuard,JwtModule],
})
export class AuthModule{}
