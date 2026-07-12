import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsEventsController, AdminAnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
@Module({imports:[AuthModule],controllers:[AnalyticsEventsController,AdminAnalyticsController],providers:[AnalyticsService],exports:[AnalyticsService]})
export class AnalyticsModule{}
