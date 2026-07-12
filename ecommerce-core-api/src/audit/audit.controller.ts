import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PERMISSIONS } from '../rbac/permissions';
import { AuditService } from './audit.service';
@Controller('admin/audit')
@UseGuards(AccessTokenGuard,PermissionsGuard)
@RequirePermissions(PERMISSIONS.auditRead)
export class AuditController{
  constructor(private readonly audit:AuditService){}
  @Get() list(@Query('limit')limit?:string):Promise<unknown[]>{return this.audit.list(Number(limit)||100);}
}
