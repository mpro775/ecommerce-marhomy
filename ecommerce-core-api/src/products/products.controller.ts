import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PERMISSIONS } from '../rbac/permissions';
import { CreateProductDto, ListProductsQuery, UpdateProductDto } from './dto';
import { ProductsService } from './products.service';
@Controller('catalog/products')
export class ProductsController{
  constructor(private readonly products:ProductsService){}
  @Get()list(@Query()query:ListProductsQuery){return this.products.publicList(query);}
  @Get(':slug')one(@Param('slug')slug:string){return this.products.publicBySlug(slug);}
  @Get(':id/related')related(@Param('id')id:string){return this.products.related(id);}
}
@Controller('admin/products')
@UseGuards(AccessTokenGuard,PermissionsGuard)
export class AdminProductsController{
  constructor(private readonly products:ProductsService,private readonly audit:AuditService){}
  @Get()@RequirePermissions(PERMISSIONS.productsRead)list(@Query()query:ListProductsQuery){return this.products.adminList(query);}
  @Get('export')@RequirePermissions(PERMISSIONS.productsRead)
  async export(@Res()response:Response):Promise<void>{const file=await this.products.exportWorkbook();response.setHeader('content-type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('content-disposition','attachment; filename=products.xlsx');response.send(file);}
  @Post('import')@RequirePermissions(PERMISSIONS.productsWrite)@UseInterceptors(FileInterceptor('file',{limits:{fileSize:5*1024*1024}}))
  import(@UploadedFile()file?:Express.Multer.File){if(!file)throw new Error('File is required');return this.products.importWorkbook(file.buffer);}
  @Get(':id')@RequirePermissions(PERMISSIONS.productsRead)one(@Param('id')id:string){return this.products.adminById(id);}
  @Post()@RequirePermissions(PERMISSIONS.productsWrite)
  async create(@Body()body:CreateProductDto,@CurrentUser()user:AuthUser){const result=await this.products.create(body) as {id:string};
    await this.audit.log({adminUserId:user.id,action:'product.created',entityType:'product',entityId:result.id});return result;}
  @Patch(':id')@RequirePermissions(PERMISSIONS.productsWrite)
  async update(@Param('id')id:string,@Body()body:UpdateProductDto,@CurrentUser()user:AuthUser){const result=await this.products.update(id,body);
    await this.audit.log({adminUserId:user.id,action:'product.updated',entityType:'product',entityId:id});return result;}
  @Delete(':id')@RequirePermissions(PERMISSIONS.productsWrite)
  async remove(@Param('id')id:string,@CurrentUser()user:AuthUser){await this.products.remove(id);
    await this.audit.log({adminUserId:user.id,action:'product.archived',entityType:'product',entityId:id});}
}
