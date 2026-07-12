import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { OutboxService } from '../outbox/outbox.service';
async function run():Promise<void>{
  const app=await NestFactory.createApplicationContext(AppModule);const outbox=app.get(OutboxService);
  const tick=async()=>{try{await outbox.processBatch();}catch(error){console.error(error);}};
  await tick();setInterval(tick,15000);
}
void run();
