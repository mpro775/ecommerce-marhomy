import { useEffect } from 'react';
import { brandConfig } from './config/brand.config';

export interface SeoOptions{title?:string;description?:string;image?:string;canonicalPath?:string;noIndex?:boolean;structuredData?:Record<string,unknown>|null}

function setMeta(selector:string,attributes:Record<string,string>):HTMLElement{
  let element=document.head.querySelector<HTMLElement>(selector);
  if(!element){element=document.createElement('meta');document.head.appendChild(element);}
  for(const[key,value]of Object.entries(attributes))element.setAttribute(key,value);
  return element;
}

export function useSeo(options:SeoOptions):void{
  useEffect(()=>{
    const siteName=brandConfig.nameAr;
    const title=options.title?`${options.title} | ${siteName}`:siteName;
    const description=options.description||brandConfig.taglineAr;
    const canonical=new URL(options.canonicalPath||window.location.pathname,window.location.origin).toString();
    document.title=title;
    setMeta('meta[name="description"]',{name:'description',content:description});
    setMeta('meta[name="robots"]',{name:'robots',content:options.noIndex?'noindex,nofollow':'index,follow'});
    setMeta('meta[property="og:title"]',{property:'og:title',content:title});
    setMeta('meta[property="og:description"]',{property:'og:description',content:description});
    setMeta('meta[property="og:type"]',{property:'og:type',content:options.structuredData?.['@type']==='Product'?'product':'website'});
    setMeta('meta[property="og:url"]',{property:'og:url',content:canonical});
    setMeta('meta[name="twitter:card"]',{name:'twitter:card',content:options.image?'summary_large_image':'summary'});
    if(options.image)setMeta('meta[property="og:image"]',{property:'og:image',content:new URL(options.image,window.location.origin).toString()});
    else document.head.querySelector('meta[property="og:image"]')?.remove();
    let link=document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if(!link){link=document.createElement('link');link.rel='canonical';document.head.appendChild(link);}link.href=canonical;
    document.getElementById('page-structured-data')?.remove();
    if(options.structuredData){const script=document.createElement('script');script.id='page-structured-data';script.type='application/ld+json';script.text=JSON.stringify(options.structuredData);document.head.appendChild(script);}
  },[options.title,options.description,options.image,options.canonicalPath,options.noIndex,JSON.stringify(options.structuredData)]);
}
