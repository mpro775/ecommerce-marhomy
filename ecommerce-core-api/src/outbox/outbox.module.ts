import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { OutboxService } from './outbox.service';
import { OutboxController } from './outbox.controller';
@Module({imports:[EmailModule],controllers:[OutboxController],providers:[OutboxService],exports:[OutboxService]})
export class OutboxModule{}
