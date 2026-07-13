import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../app.module';
import { IdempotencyKeyCleanupService } from '../quote-requests/idempotency-key-cleanup.service';

async function run():Promise<void>{
  const app=await NestFactory.createApplicationContext(AppModule);
  const cleanup=app.get(IdempotencyKeyCleanupService),config=app.get(ConfigService);
  const tick=async()=>{try{await cleanup.run();}catch(error){console.error(error);}};
  await tick();setInterval(tick,config.get<number>('IDEMPOTENCY_CLEANUP_INTERVAL_MS',3600000));
}
void run();
