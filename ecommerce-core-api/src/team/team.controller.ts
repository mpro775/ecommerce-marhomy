import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PERMISSIONS } from '../rbac/permissions';
import { AcceptInviteDto, InviteAdminDto, RequestPasswordResetDto, ResetPasswordDto, UpdateAdminDto } from './dto';
import { TeamService } from './team.service';
@Controller('admin/team')
@UseGuards(AccessTokenGuard,PermissionsGuard)
export class TeamController{
  constructor(private readonly team:TeamService){}
  @Get('users')@RequirePermissions(PERMISSIONS.teamRead)users(){return this.team.users();}
  @Get('roles')@RequirePermissions(PERMISSIONS.teamRead)roles(){return this.team.roles();}
  @Post('invites')@RequirePermissions(PERMISSIONS.teamWrite)
  invite(@Body()body:InviteAdminDto,@CurrentUser()user:AuthUser){return this.team.invite(body,user);}
  @Patch('users/:id')@RequirePermissions(PERMISSIONS.teamWrite)
  update(@Param('id')id:string,@Body()body:UpdateAdminDto){return this.team.update(id,body);}
}
@Controller()
export class TeamPublicController{
  constructor(private readonly team:TeamService){}
  @Post('team/invites/accept')@Throttle({default:{limit:5,ttl:60000}})
  accept(@Body()body:AcceptInviteDto){return this.team.accept(body);}
  @Post('auth/password-reset/request')@Throttle({default:{limit:5,ttl:60000}})
  request(@Body()body:RequestPasswordResetDto){return this.team.requestReset(body.email);}
  @Post('auth/password-reset/confirm')@Throttle({default:{limit:5,ttl:60000}})
  reset(@Body()body:ResetPasswordDto){return this.team.reset(body);}
}
