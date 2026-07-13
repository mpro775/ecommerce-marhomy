import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuoteRequestsController, AdminQuoteRequestsController, ContactsController } from './quote-requests.controller';
import { QuoteRequestsService } from './quote-requests.service';
import { IdempotencyKeyCleanupService } from './idempotency-key-cleanup.service';
@Module({imports:[AuthModule],controllers:[QuoteRequestsController,AdminQuoteRequestsController,ContactsController],
  providers:[QuoteRequestsService,IdempotencyKeyCleanupService],exports:[QuoteRequestsService,IdempotencyKeyCleanupService]})
export class QuoteRequestsModule{}
