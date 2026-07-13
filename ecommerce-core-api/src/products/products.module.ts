import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductsController, AdminProductsController, AdminProductModelsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductModelsService } from './product-models.service';
import { AuditModule } from '../audit/audit.module';
@Module({imports:[AuthModule,AuditModule],controllers:[ProductsController,AdminProductsController,AdminProductModelsController],providers:[ProductsService,ProductModelsService],exports:[ProductsService,ProductModelsService]})
export class ProductsModule{}
