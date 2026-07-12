import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuoteRequestsController, AdminQuoteRequestsController, ContactsController } from './quote-requests.controller';
import { QuoteRequestsService } from './quote-requests.service';
@Module({imports:[AuthModule],controllers:[QuoteRequestsController,AdminQuoteRequestsController,ContactsController],
  providers:[QuoteRequestsService],exports:[QuoteRequestsService]})
export class QuoteRequestsModule{}
