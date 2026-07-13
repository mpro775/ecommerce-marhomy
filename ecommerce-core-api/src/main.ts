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
  const exactOrigins = (config.get<string>('ALLOWED_ORIGINS', '') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedDomains = (config.get<string>('ALLOWED_ORIGIN_DOMAINS', '') ?? '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      // يسمح بطلبات السيرفرات والأدوات التي لا ترسل Origin
      if (!origin) {
        return callback(null, true);
      }

      try {
        const url = new URL(origin);
        const hostname = url.hostname.toLowerCase();

        const isExactOrigin = exactOrigins.includes(origin);

        const isAllowedDomain = allowedDomains.some(
          (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
        );

        const isHttps = url.protocol === 'https:';

        if (isHttps && (isExactOrigin || isAllowedDomain)) {
          return callback(null, true);
        }

        return callback(new Error(`CORS origin not allowed: ${origin}`));
      } catch {
        return callback(new Error('Invalid CORS origin'));
      }
    },
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  app.useGlobalFilters(new AllExceptionsFilter());app.useGlobalInterceptors(new RequestLoggingInterceptor());
  const document=SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('Catalog and Quote Request API')
    .setDescription('Product catalog and quote request management').setVersion('1.0.0').addBearerAuth().build());
  SwaggerModule.setup('docs',app,document);
  const port=config.get<number>('PORT',3000);await app.listen(port);new Logger('Bootstrap').log('API listening on port '+port);
}
void bootstrap();
