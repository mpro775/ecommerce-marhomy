import { Controller, Get, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { DatabaseService } from '../database/database.service';

interface SitemapRow{path:string;updated_at:Date|string|null}

@Controller('seo')
export class SeoController{
  constructor(private readonly database:DatabaseService,private readonly config:ConfigService){}

  @Get('sitemap.xml')
  async sitemap(@Res()response:Response):Promise<void>{
    const base=this.config.get<string>('STOREFRONT_URL','http://localhost:5174').replace(/\/$/,'');
    const result=await this.database.query<SitemapRow>(`SELECT '/products/'||slug AS path,updated_at FROM products WHERE status='published'
      UNION ALL SELECT '/products/'||p.slug||'/models/'||replace(m.model_code,' ','%20') AS path,m.updated_at
        FROM product_models m JOIN products p ON p.id=m.product_id WHERE p.status='published' AND m.is_active AND m.availability_status<>'hidden'
      UNION ALL SELECT '/categories/'||slug AS path,updated_at FROM categories WHERE is_active=TRUE
      UNION ALL SELECT '/brands/'||slug AS path,updated_at FROM brands WHERE is_active=TRUE ORDER BY path`);
    const staticPaths=['/','/products','/about','/contact','/faq'];
    const urls=[...staticPaths.map(path=>({path,updated_at:null})),...result.rows].map(row=>{
      const lastmod=row.updated_at?`<lastmod>${this.escape(new Date(row.updated_at).toISOString())}</lastmod>`:'';
      return `<url><loc>${this.escape(base+row.path)}</loc>${lastmod}</url>`;
    }).join('');
    response.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
  }

  private escape(value:string):string{return value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[character]??character));}
}
