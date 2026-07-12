import type { Request } from 'express';
export interface RequestContext{ipAddress:string|null;userAgent:string|null;requestId:string|null}
export function getRequestContext(request:Request&{requestId?:string}):RequestContext{
  const forwarded=request.headers['x-forwarded-for']; const ip=Array.isArray(forwarded)?forwarded[0]:forwarded?.split(',')[0]?.trim();
  return{ipAddress:ip??request.ip??null,userAgent:request.headers['user-agent']?.slice(0,1000)??null,requestId:request.requestId??null};
}
