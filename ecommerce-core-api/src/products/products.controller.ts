import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PERMISSIONS } from '../rbac/permissions';
import {
  BulkModelStatusDto, CreateProductDto, CreateProductModelDto, DuplicateModelDto, ListProductsQuery,
  ProductImageDto, ReorderImagesDto, ReorderModelsDto, ReplaceModelSpecificationsDto,
  UpdateProductDto, UpdateProductImageDto, UpdateProductModelDto,
} from './dto';
import { ProductModelsService } from './product-models.service';
import { ProductsService } from './products.service';

@Controller('catalog/products')
export class ProductsController {
  constructor(private readonly products:ProductsService){}
  @Get() list(@Query()query:ListProductsQuery){return this.products.publicList(query);}
  @Get(':slug/models/compare') compare(@Param('slug')slug:string,@Query('models')models=''){return this.products.compare(slug,models.split(',').filter(Boolean));}
  @Get(':slug/models/:modelCode') model(@Param('slug')slug:string,@Param('modelCode')modelCode:string){return this.products.publicByModel(slug,modelCode);}
  @Get(':slug') one(@Param('slug')slug:string){return this.products.publicBySlug(slug);}
  @Get(':id/related') related(@Param('id')id:string){return this.products.related(id);}
}

@Controller('admin/products')
@UseGuards(AccessTokenGuard,PermissionsGuard)
export class AdminProductsController {
  constructor(private readonly products:ProductsService,private readonly audit:AuditService){}
  @Get() @RequirePermissions(PERMISSIONS.productsRead) list(@Query()query:ListProductsQuery){return this.products.adminList(query);}
  @Get(':id') @RequirePermissions(PERMISSIONS.productsRead) one(@Param('id')id:string){return this.products.adminById(id);}
  @Post() @RequirePermissions(PERMISSIONS.productsWrite)
  async create(@Body()body:CreateProductDto,@CurrentUser()user:AuthUser){const result=await this.products.create(body) as {id:string};
    await this.audit.log({adminUserId:user.id,action:'product.created',entityType:'product',entityId:result.id});return result;}
  @Patch(':id') @RequirePermissions(PERMISSIONS.productsWrite)
  async update(@Param('id')id:string,@Body()body:UpdateProductDto,@CurrentUser()user:AuthUser){const result=await this.products.update(id,body);
    await this.audit.log({adminUserId:user.id,action:'product.updated',entityType:'product',entityId:id});return result;}
  @Post(':id/publish') @RequirePermissions(PERMISSIONS.productsWrite)
  async publish(@Param('id')id:string,@CurrentUser()user:AuthUser){const result=await this.products.publish(id);await this.audit.log({adminUserId:user.id,action:'product.published',entityType:'product',entityId:id});return result;}
  @Post(':id/archive') @RequirePermissions(PERMISSIONS.productsWrite)
  async archive(@Param('id')id:string,@CurrentUser()user:AuthUser){const result=await this.products.archive(id);await this.audit.log({adminUserId:user.id,action:'product.archived',entityType:'product',entityId:id});return result;}
  @Delete(':id') @RequirePermissions(PERMISSIONS.productsWrite) remove(@Param('id')id:string){return this.products.remove(id);}
}

@Controller('admin/products/:productId/models')
@UseGuards(AccessTokenGuard,PermissionsGuard)
export class AdminProductModelsController {
  constructor(private readonly models:ProductModelsService,private readonly audit:AuditService){}
  @Get() @RequirePermissions(PERMISSIONS.productModelsRead) list(@Param('productId')productId:string){return this.models.list(productId);}
  @Get(':modelId') @RequirePermissions(PERMISSIONS.productModelsRead) one(@Param('productId')productId:string,@Param('modelId')modelId:string){return this.models.one(productId,modelId);}
  @Post() @RequirePermissions(PERMISSIONS.productModelsWrite)
  async create(@Param('productId')productId:string,@Body()body:CreateProductModelDto,@CurrentUser()user:AuthUser){const result=await this.models.create(productId,body) as {id:string};
    await this.audit.log({adminUserId:user.id,action:'model.created',entityType:'product_model',entityId:result.id,metadata:{productId}});return result;}
  @Patch('reorder') @RequirePermissions(PERMISSIONS.productModelsWrite) reorder(@Param('productId')productId:string,@Body()body:ReorderModelsDto){return this.models.reorder(productId,body.modelIds);}
  @Patch('bulk-status') @RequirePermissions(PERMISSIONS.productModelsWrite) bulk(@Param('productId')productId:string,@Body()body:BulkModelStatusDto){return this.models.bulkStatus(productId,body);}
  @Patch(':modelId') @RequirePermissions(PERMISSIONS.productModelsWrite)
  async update(@Param('productId')productId:string,@Param('modelId')modelId:string,@Body()body:UpdateProductModelDto,@CurrentUser()user:AuthUser){const result=await this.models.update(productId,modelId,body);
    await this.audit.log({adminUserId:user.id,action:'model.updated',entityType:'product_model',entityId:modelId});return result;}
  @Delete(':modelId') @RequirePermissions(PERMISSIONS.productModelsWrite) remove(@Param('productId')productId:string,@Param('modelId')modelId:string){return this.models.remove(productId,modelId);}
  @Post(':modelId/duplicate') @RequirePermissions(PERMISSIONS.productModelsWrite)
  async duplicate(@Param('productId')productId:string,@Param('modelId')modelId:string,@Body()body:DuplicateModelDto,@CurrentUser()user:AuthUser){const result=await this.models.duplicate(productId,modelId,body) as {id:string};
    await this.audit.log({adminUserId:user.id,action:'model.duplicated',entityType:'product_model',entityId:result.id,metadata:{sourceModelId:modelId}});return result;}
  @Patch(':modelId/set-default') @RequirePermissions(PERMISSIONS.productModelsWrite)
  async setDefault(@Param('productId')productId:string,@Param('modelId')modelId:string,@CurrentUser()user:AuthUser){const result=await this.models.setDefault(productId,modelId);
    await this.audit.log({adminUserId:user.id,action:'model.set_default',entityType:'product_model',entityId:modelId});return result;}
  @Post(':modelId/images') @RequirePermissions(PERMISSIONS.productModelsWrite) addImage(@Param('productId')productId:string,@Param('modelId')modelId:string,@Body()body:ProductImageDto){return this.models.addImage(productId,modelId,body);}
  @Patch(':modelId/images/reorder') @RequirePermissions(PERMISSIONS.productModelsWrite) reorderImages(@Param('productId')productId:string,@Param('modelId')modelId:string,@Body()body:ReorderImagesDto){return this.models.reorderImages(productId,modelId,body.imageIds);}
  @Patch(':modelId/images/:imageId') @RequirePermissions(PERMISSIONS.productModelsWrite) updateImage(@Param('productId')productId:string,@Param('modelId')modelId:string,@Param('imageId')imageId:string,@Body()body:UpdateProductImageDto){return this.models.updateImage(productId,modelId,imageId,body);}
  @Delete(':modelId/images/:imageId') @RequirePermissions(PERMISSIONS.productModelsWrite) removeImage(@Param('productId')productId:string,@Param('modelId')modelId:string,@Param('imageId')imageId:string){return this.models.removeImage(productId,modelId,imageId);}
  @Get(':modelId/specifications') @RequirePermissions(PERMISSIONS.productModelsRead) specifications(@Param('productId')productId:string,@Param('modelId')modelId:string){return this.models.specifications(productId,modelId);}
  @Put(':modelId/specifications') @RequirePermissions(PERMISSIONS.productModelsWrite) putSpecifications(@Param('productId')productId:string,@Param('modelId')modelId:string,@Body()body:ReplaceModelSpecificationsDto){return this.models.putSpecifications(productId,modelId,body.values);}
}
