import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../app.module';
import { CartMaintenanceService } from '../quote-carts/cart-maintenance.service';

async function run():Promise<void>{
  const app=await NestFactory.createApplicationContext(AppModule);
  const maintenance=app.get(CartMaintenanceService),config=app.get(ConfigService);
  const tick=async()=>{try{await maintenance.run();}catch(error){console.error(error);}};
  await tick();setInterval(tick,config.get<number>('QUOTE_CART_MAINTENANCE_INTERVAL_MS',900000));
}
void run();
