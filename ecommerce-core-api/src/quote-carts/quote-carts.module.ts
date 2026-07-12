import { Module } from '@nestjs/common';
import { QuoteCartsController } from './quote-carts.controller';
import { QuoteCartsService } from './quote-carts.service';
import { CartMaintenanceService } from './cart-maintenance.service';
@Module({controllers:[QuoteCartsController],providers:[QuoteCartsService,CartMaintenanceService],exports:[QuoteCartsService,CartMaintenanceService]})
export class QuoteCartsModule{}
