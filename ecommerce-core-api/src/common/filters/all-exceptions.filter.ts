import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { mapPostgresError } from './postgres-error.mapper';
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger=new Logger(AllExceptionsFilter.name);
  catch(error:unknown,host:ArgumentsHost):void {
    const request=host.switchToHttp().getRequest<Request&{requestId?:string}>();
    const response=host.switchToHttp().getResponse<Response>();
    const databaseError=mapPostgresError(error);
    const status=databaseError?.status??(error instanceof HttpException?error.getStatus():HttpStatus.INTERNAL_SERVER_ERROR);
    const body=error instanceof HttpException?error.getResponse():null;
    const message=databaseError?.message??(typeof body==='string'?body:(body&&typeof body==='object'&&'message' in body?(body as {message:unknown}).message:status===500?'Internal server error':'Request failed'));
    if(status>=500)this.logger.error(error instanceof Error?error.stack:String(error));
    response.status(status).json({statusCode:status,message,path:request.originalUrl,requestId:request.requestId??null,timestamp:new Date().toISOString()});
  }
}
