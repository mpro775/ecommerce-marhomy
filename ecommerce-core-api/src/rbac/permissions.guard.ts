import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS } from './require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
@Injectable()
export class PermissionsGuard implements CanActivate{
  constructor(private readonly reflector:Reflector){}
  canActivate(context:ExecutionContext):boolean{
    const required=this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS,[context.getHandler(),context.getClass()])??[];
    if(!required.length)return true;const user=context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if(!user||!required.every((permission)=>user.permissions.includes(permission)))throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
