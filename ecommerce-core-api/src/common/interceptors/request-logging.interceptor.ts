import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger=new Logger('HTTP');
  intercept(context:ExecutionContext,next:CallHandler):Observable<unknown>{
    const request=context.switchToHttp().getRequest<{method:string;originalUrl:string}>(); const startedAt=Date.now();
    return next.handle().pipe(finalize(()=>this.logger.log(request.method+' '+request.originalUrl+' '+(Date.now()-startedAt)+'ms')));
  }
}
