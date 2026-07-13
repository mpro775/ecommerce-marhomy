import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { envValidationSchema } from './config/env.validation';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { CatalogModule } from './catalog/catalog.module';
import { ProductsModule } from './products/products.module';
import { QuoteCartsModule } from './quote-carts/quote-carts.module';
import { QuoteRequestsModule } from './quote-requests/quote-requests.module';
import { EmailModule } from './email/email.module';
import { OutboxModule } from './outbox/outbox.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TeamModule } from './team/team.module';
import { MediaModule } from './media/media.module';
import { SeoModule } from './seo/seo.module';
import { CatalogImportModule } from './catalog-import/catalog-import.module';
@Module({
  imports:[
    ConfigModule.forRoot({isGlobal:true,envFilePath:['.env','../../.env'],validationSchema:envValidationSchema}),
    ThrottlerModule.forRoot([{ttl:60000,limit:100}]),DatabaseModule,HealthModule,AuthModule,AuditModule,
    CatalogModule,ProductsModule,QuoteCartsModule,QuoteRequestsModule,EmailModule,OutboxModule,
    NotificationsModule,AnalyticsModule,TeamModule,MediaModule,SeoModule,CatalogImportModule],
  providers:[{provide:APP_GUARD,useClass:ThrottlerGuard}],
})
export class AppModule implements NestModule{
  configure(consumer:MiddlewareConsumer):void{consumer.apply(RequestIdMiddleware).forRoutes('{*path}');}
}
