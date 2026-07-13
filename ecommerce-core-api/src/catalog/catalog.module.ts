import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogController, AdminBrandsController, AdminCategoriesController, AdminSpecificationsController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { AuditModule } from '../audit/audit.module';
@Module({imports:[AuthModule,AuditModule],controllers:[CatalogController,AdminCategoriesController,AdminBrandsController,AdminSpecificationsController],providers:[CatalogService],exports:[CatalogService]})
export class CatalogModule{}
