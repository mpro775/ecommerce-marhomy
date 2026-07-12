import type { Request } from 'express';
export interface AuthUser{id:string;email:string;fullName:string;role:string;permissions:string[];sessionId:string}
export interface AuthenticatedRequest extends Request{user?:AuthUser}
export interface AuthResult{accessToken:string;refreshToken:string;user:AuthUser}
export interface AccessPayload{sub:string;sid:string;email:string;fullName:string}
