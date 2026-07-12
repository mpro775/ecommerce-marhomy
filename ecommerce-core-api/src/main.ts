import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import * as Sentry from '@sentry/nestjs';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
async function bootstrap():Promise<void>{
  const app=await NestFactory.create(AppModule,{bodyParser:false});const config=app.get(ConfigService);
  const sentryDsn=config.get<string>('SENTRY_DSN');if(sentryDsn)Sentry.init({dsn:sentryDsn,environment:config.get<string>('NODE_ENV')});
  app.setGlobalPrefix('api');app.use(helmet());app.use(json({limit:config.get<string>('HTTP_JSON_BODY_LIMIT','1mb')}));
  app.use(urlencoded({limit:config.get<string>('HTTP_JSON_BODY_LIMIT','1mb'),extended:true}));
  const origins=new Set((config.get<string>('ALLOWED_ORIGINS','')??'').split(',').map((item)=>item.trim()).filter(Boolean));
  app.enableCors({credentials:true,origin:(origin:string|undefined,callback:(error:Error|null,allow?:boolean)=>void)=>
    callback(null,!origin||origins.has(origin))});
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  app.useGlobalFilters(new AllExceptionsFilter());app.useGlobalInterceptors(new RequestLoggingInterceptor());
  const document=SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('Catalog and Quote Request API')
    .setDescription('Product catalog and quote request management').setVersion('1.0.0').addBearerAuth().build());
  SwaggerModule.setup('docs',app,document);
  const port=config.get<number>('PORT',3000);await app.listen(port);new Logger('Bootstrap').log('API listening on port '+port);
}
void bootstrap();
