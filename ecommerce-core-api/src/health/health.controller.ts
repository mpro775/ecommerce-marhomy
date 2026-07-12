import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
@Controller('health')
export class HealthController{
  constructor(private readonly database:DatabaseService){}
  @Get()async health():Promise<{status:string;database:string;timestamp:string}>{
    await this.database.ping();return{status:'ok',database:'up',timestamp:new Date().toISOString()};
  }
}
