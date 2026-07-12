const API=(import.meta.env.VITE_API_BASE_URL as string|undefined)??'/api';
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const headers=new Headers(options.headers);if(options.body&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(API+path,{...options,headers});if(!response.ok){const body=await response.json().catch(()=>({message:'Request failed'})) as {message?:string|string[]};
    throw new Error(Array.isArray(body.message)?body.message.join(', '):body.message??'Request failed');}
  if(response.status===204)return undefined as T;return response.json() as Promise<T>;
}
export async function track(eventName:string,data:Record<string,unknown>={}):Promise<void>{
  const anonymousId=getAnonymousId();await api('/analytics/events',{method:'POST',body:JSON.stringify({eventName,anonymousId,source:'web',...data})}).catch(()=>undefined);
}
export function getAnonymousId():string{
  let id=localStorage.getItem('rfq-anonymous-id');if(!id){id=crypto.randomUUID();localStorage.setItem('rfq-anonymous-id',id);}return id;
}
