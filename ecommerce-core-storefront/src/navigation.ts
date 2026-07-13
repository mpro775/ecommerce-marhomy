import type { Row } from './api';
export type Page=
  |{name:'home'}|{name:'catalog';key?:string;scope?:'category'|'brand'}|{name:'product';slug:string;modelCode?:string}
  |{name:'cart'}|{name:'static';key:string}|{name:'success';data?:Row}|{name:'tracking';requestNumber?:string;token?:string};
export function pageFromLocation(location:Location=window.location):Page{const parts=location.pathname.replace(/^\/+|\/+$/g,'').split('/').filter(Boolean).map(decodeURIComponent);const query=new URLSearchParams(location.search);
  if(parts[0]==='products'&&parts[1]&&parts[2]==='models'&&parts[3])return{name:'product',slug:parts[1],modelCode:parts[3]};
  if(parts[0]==='products'&&parts[1])return{name:'product',slug:parts[1]};if(parts[0]==='products')return{name:'catalog'};
  if(parts[0]==='categories'&&parts[1])return{name:'catalog',scope:'category',key:parts[1]};if(parts[0]==='brands'&&parts[1])return{name:'catalog',scope:'brand',key:parts[1]};
  if(parts[0]==='cart')return{name:'cart'};if(parts[0]==='request-success')return{name:'success'};
  if(parts[0]==='track')return{name:'tracking',requestNumber:parts[1]||query.get('request')||undefined,token:query.get('token')||undefined};
  if(parts[0]&&['about','contact','privacy','terms','faq'].includes(parts[0]))return{name:'static',key:parts[0]};return{name:'home'};}
export function pathForPage(page:Page):string{if(page.name==='home')return'/';if(page.name==='product')return`/products/${encodeURIComponent(page.slug)}${page.modelCode?'/models/'+encodeURIComponent(page.modelCode):''}`;
  if(page.name==='catalog'){if(page.scope==='category'&&page.key)return'/categories/'+encodeURIComponent(page.key);if(page.scope==='brand'&&page.key)return'/brands/'+encodeURIComponent(page.key);return'/products';}
  if(page.name==='cart')return'/cart';if(page.name==='static')return'/'+page.key;if(page.name==='success')return'/request-success';return'/track'+(page.requestNumber?'/'+encodeURIComponent(page.requestNumber):'')+(page.token?'?token='+encodeURIComponent(page.token):'');}
