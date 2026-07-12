import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PERMISSIONS } from '../rbac/permissions';
import { AnalyticsService } from './analytics.service';
import { TrackCatalogEventDto } from './dto';
@Controller('analytics/events')
export class AnalyticsEventsController{
  constructor(private readonly analytics:AnalyticsService){}
  @Post()@HttpCode(204)@Throttle({default:{limit:120,ttl:60000}})
  track(@Body()body:TrackCatalogEventDto):Promise<void>{return this.analytics.track(body);}
}
@Controller('admin/analytics')
@UseGuards(AccessTokenGuard,PermissionsGuard)
export class AdminAnalyticsController{
  constructor(private readonly analytics:AnalyticsService){}
  @Get('dashboard')@RequirePermissions(PERMISSIONS.dashboardRead)
  dashboard(){return this.analytics.dashboard();}
}
