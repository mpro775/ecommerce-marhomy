const API_BASE=(import.meta.env.VITE_API_BASE_URL as string|undefined)??'/api';
export interface SessionUser{id:string;email:string;fullName:string;role:string;permissions:string[];sessionId:string}
export interface Session{accessToken:string;refreshToken:string;user:SessionUser}
let session:Session|null=null;
export function setSession(next:Session|null):void{session=next;if(next)localStorage.setItem('rfq-admin-session',JSON.stringify(next));else localStorage.removeItem('rfq-admin-session');}
export function restoreSession():Session|null{
  try{const value=localStorage.getItem('rfq-admin-session');session=value?JSON.parse(value) as Session:null;return session;}catch{return null;}
}
async function refresh():Promise<boolean>{
  if(!session?.refreshToken)return false;
  const response=await fetch(API_BASE+'/auth/refresh',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({refreshToken:session.refreshToken})});
  if(!response.ok){setSession(null);return false;}setSession(await response.json() as Session);return true;
}
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const headers=new Headers(options.headers);if(!(options.body instanceof FormData))headers.set('content-type','application/json');
  if(session?.accessToken)headers.set('authorization','Bearer '+session.accessToken);
  let response=await fetch(API_BASE+path,{...options,headers});
  if(response.status===401&&await refresh()){headers.set('authorization','Bearer '+session!.accessToken);response=await fetch(API_BASE+path,{...options,headers});}
  if(!response.ok){const body=await response.json().catch(()=>({message:'تعذر تنفيذ الطلب'})) as {message?:string|string[]};
    throw new Error(Array.isArray(body.message)?body.message.join('، '):body.message??'تعذر تنفيذ الطلب');}
  if(response.status===204)return undefined as T;const text=await response.text();return(text?JSON.parse(text):undefined) as T;
}
export async function download(path:string,fileName:string):Promise<void>{
  const headers=new Headers();if(session?.accessToken)headers.set('authorization','Bearer '+session.accessToken);
  const response=await fetch(API_BASE+path,{headers});if(!response.ok)throw new Error('تعذر تنزيل الملف');
  const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=fileName;link.click();URL.revokeObjectURL(url);
}
