import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PERMISSIONS } from '../rbac/permissions';
import { NotificationsService } from './notifications.service';
@Controller('admin/notifications')
@UseGuards(AccessTokenGuard,PermissionsGuard)
@RequirePermissions(PERMISSIONS.notificationsRead)
export class NotificationsController{
  constructor(private readonly notifications:NotificationsService){}
  @Get()list(@CurrentUser()user:AuthUser,@Query('unread')unread?:string){return this.notifications.list(user.id,unread==='true');}
  @Patch('read-all')@RequirePermissions(PERMISSIONS.notificationsRead,PERMISSIONS.notificationsWrite)readAll(@CurrentUser()user:AuthUser){return this.notifications.readAll(user.id);}
  @Patch(':id/read')@RequirePermissions(PERMISSIONS.notificationsRead,PERMISSIONS.notificationsWrite)read(@Param('id')id:string,@CurrentUser()user:AuthUser){return this.notifications.read(id,user.id);}
}
