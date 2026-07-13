import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { CatalogImportController } from './catalog-import.controller';
import { CatalogImportService } from './catalog-import.service';
@Module({imports:[AuthModule,MediaModule],controllers:[CatalogImportController],providers:[CatalogImportService],exports:[CatalogImportService]})
export class CatalogImportModule{}
