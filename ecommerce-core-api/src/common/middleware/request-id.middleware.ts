import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const requestId=String(request.headers['x-request-id']??randomUUID()).slice(0,100);
    (request as Request&{requestId:string}).requestId=requestId; response.setHeader('x-request-id',requestId); next();
  }
}
