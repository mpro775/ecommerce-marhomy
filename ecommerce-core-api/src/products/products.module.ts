import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductsController, AdminProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { AuditModule } from '../audit/audit.module';
@Module({imports:[AuthModule,AuditModule],controllers:[ProductsController,AdminProductsController],providers:[ProductsService],exports:[ProductsService]})
export class ProductsModule{}
