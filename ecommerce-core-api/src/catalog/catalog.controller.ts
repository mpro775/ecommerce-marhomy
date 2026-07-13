import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PERMISSIONS } from '../rbac/permissions';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { CatalogService } from './catalog.service';
import { CreateBrandDto, CreateCategoryDto, CreateSpecificationDto, ReorderCategoriesDto, ReplaceCategorySpecificationsDto, UpdateBrandDto, UpdateCategoryDto, UpdateSpecificationDto } from './dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog:CatalogService){}
  @Get('categories') categories(){return this.catalog.publicCategories();}
  @Get('categories/:slug/products') categoryProducts(@Param('slug')slug:string){return this.catalog.publicCategoryProducts(slug);}
  @Get('categories/:slug') category(@Param('slug')slug:string){return this.catalog.publicCategory(slug);}
  @Get('brands') brands(){return this.catalog.publicBrands();}
  @Get('brands/:slug') brand(@Param('slug')slug:string){return this.catalog.publicBrand(slug);}
  @Get('filters') filters(@Query('category')category?:string){return this.catalog.publicFilters(category);}
}

@Controller('admin/categories')
@UseGuards(AccessTokenGuard,PermissionsGuard)
export class AdminCategoriesController {
  constructor(private readonly catalog:CatalogService,private readonly audit:AuditService){}
  @Get() @RequirePermissions(PERMISSIONS.categoriesRead) list(){return this.catalog.categories();}
  @Post() @RequirePermissions(PERMISSIONS.categoriesWrite)
  async create(@Body()body:CreateCategoryDto,@CurrentUser()user:AuthUser){const result=await this.catalog.createCategory(body) as {id:string};await this.audit.log({adminUserId:user.id,action:'category.created',entityType:'category',entityId:result.id});return result;}
  @Patch('reorder') @RequirePermissions(PERMISSIONS.categoriesWrite) reorder(@Body()body:ReorderCategoriesDto){return this.catalog.reorderCategories(body.categoryIds);}
  @Patch(':id') @RequirePermissions(PERMISSIONS.categoriesWrite) update(@Param('id')id:string,@Body()body:UpdateCategoryDto){return this.catalog.updateCategory(id,body);}
  @Delete(':id') @RequirePermissions(PERMISSIONS.categoriesWrite) remove(@Param('id')id:string){return this.catalog.removeCategory(id);}
  @Get(':id/specifications') @RequirePermissions(PERMISSIONS.specificationsRead) specifications(@Param('id')id:string){return this.catalog.categorySpecifications(id);}
  @Put(':id/specifications') @RequirePermissions(PERMISSIONS.specificationsWrite) putSpecifications(@Param('id')id:string,@Body()body:ReplaceCategorySpecificationsDto){return this.catalog.replaceCategorySpecifications(id,body.values);}
}

@Controller('admin/brands')
@UseGuards(AccessTokenGuard,PermissionsGuard)
export class AdminBrandsController {
  constructor(private readonly catalog:CatalogService){}
  @Get() @RequirePermissions(PERMISSIONS.brandsRead) list(){return this.catalog.brands();}
  @Post() @RequirePermissions(PERMISSIONS.brandsWrite) create(@Body()body:CreateBrandDto){return this.catalog.createBrand(body);}
  @Patch(':id') @RequirePermissions(PERMISSIONS.brandsWrite) update(@Param('id')id:string,@Body()body:UpdateBrandDto){return this.catalog.updateBrand(id,body);}
  @Delete(':id') @RequirePermissions(PERMISSIONS.brandsWrite) remove(@Param('id')id:string){return this.catalog.removeBrand(id);}
}

@Controller('admin/specifications')
@UseGuards(AccessTokenGuard,PermissionsGuard)
export class AdminSpecificationsController {
  constructor(private readonly catalog:CatalogService,private readonly audit:AuditService){}
  @Get() @RequirePermissions(PERMISSIONS.specificationsRead) list(){return this.catalog.specifications();}
  @Get(':id') @RequirePermissions(PERMISSIONS.specificationsRead) one(@Param('id')id:string){return this.catalog.specification(id);}
  @Post() @RequirePermissions(PERMISSIONS.specificationsWrite)
  async create(@Body()body:CreateSpecificationDto,@CurrentUser()user:AuthUser){const result=await this.catalog.createSpecification(body) as {id:string};await this.audit.log({adminUserId:user.id,action:'specification.created',entityType:'specification',entityId:result.id});return result;}
  @Patch(':id') @RequirePermissions(PERMISSIONS.specificationsWrite) update(@Param('id')id:string,@Body()body:UpdateSpecificationDto){return this.catalog.updateSpecification(id,body);}
  @Delete(':id') @RequirePermissions(PERMISSIONS.specificationsWrite) remove(@Param('id')id:string){return this.catalog.removeSpecification(id);}
}
