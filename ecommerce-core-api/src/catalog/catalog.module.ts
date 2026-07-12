import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogController, AdminCatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { AuditModule } from '../audit/audit.module';
@Module({imports:[AuthModule,AuditModule],controllers:[CatalogController,AdminCatalogController],providers:[CatalogService],exports:[CatalogService]})
export class CatalogModule{}
