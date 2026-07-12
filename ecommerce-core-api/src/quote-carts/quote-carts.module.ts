import { Module } from '@nestjs/common';
import { QuoteCartsController } from './quote-carts.controller';
import { QuoteCartsService } from './quote-carts.service';
@Module({controllers:[QuoteCartsController],providers:[QuoteCartsService],exports:[QuoteCartsService]})
export class QuoteCartsModule{}
