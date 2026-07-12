import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { CatalogService } from './catalog.service';
import { CreateCatalogValueDto, UpdateCatalogEntryDto, UpdateCatalogValueDto, UpdateCategoryAttributesDto, UpsertCatalogEntryDto } from './dto';
import { AuditService } from '../audit/audit.service';
@Controller('catalog')
export class CatalogController{
  constructor(private readonly catalog:CatalogService){}
  @Get('categories')categories():Promise<unknown[]>{return this.catalog.publicCategories();}
  @Get('categories/:slug')category(@Param('slug')slug:string):Promise<unknown>{return this.catalog.publicCategory(slug);}
  @Get('brands')brands():Promise<unknown[]>{return this.catalog.publicBrands();}
  @Get('brands/:slug')brand(@Param('slug')slug:string):Promise<unknown>{return this.catalog.publicBrand(slug);}
  @Get('filters')filters():Promise<unknown[]>{return this.catalog.publicFilters();}
}
@Controller('admin/catalog')
@UseGuards(AccessTokenGuard,PermissionsGuard)
export class AdminCatalogController{
  constructor(private readonly catalog:CatalogService,private readonly audit:AuditService){}
  @Get(':kind')
  list(@Param('kind')kind:'categories'|'brands'|'attributes'|'filters',@CurrentUser()user:AuthUser):Promise<unknown[]>{
    this.assertPermission(user,kind,'read');return this.catalog.list(kind);}
  @Post(':kind')
  async create(@Param('kind')kind:'categories'|'brands'|'attributes'|'filters',@Body()body:UpsertCatalogEntryDto,@CurrentUser()user:AuthUser):Promise<unknown>{
    this.assertPermission(user,kind,'write');const result=await this.catalog.create(kind,body) as {id:string};
    await this.audit.log({adminUserId:user.id,action:'catalog.created',entityType:kind,entityId:result.id});return result;}
  @Patch(':kind/:id')
  async update(@Param('kind')kind:'categories'|'brands'|'attributes'|'filters',@Param('id')id:string,@Body()body:UpdateCatalogEntryDto,@CurrentUser()user:AuthUser):Promise<unknown>{
    this.assertPermission(user,kind,'write');const result=await this.catalog.update(kind,id,body);
    await this.audit.log({adminUserId:user.id,action:'catalog.updated',entityType:kind,entityId:id});return result;}
  @Delete(':kind/:id')
  async remove(@Param('kind')kind:'categories'|'brands'|'attributes'|'filters',@Param('id')id:string,@CurrentUser()user:AuthUser):Promise<void>{
    this.assertPermission(user,kind,'write');await this.catalog.remove(kind,id);
    await this.audit.log({adminUserId:user.id,action:'catalog.deleted',entityType:kind,entityId:id});}
  @Post(':kind/:id/values')
  value(@Param('kind')kind:'attributes'|'filters',@Param('id')id:string,@Body()body:CreateCatalogValueDto,@CurrentUser()user:AuthUser):Promise<unknown>{
    this.assertPermission(user,kind,'write');return this.catalog.addValue(kind,id,body);}
  @Patch(':kind/:id/values/:valueId')
  updateValue(@Param('kind')kind:'attributes'|'filters',@Param('id')id:string,@Param('valueId')valueId:string,
    @Body()body:UpdateCatalogValueDto,@CurrentUser()user:AuthUser):Promise<unknown>{
    this.assertPermission(user,kind,'write');return this.catalog.updateValue(kind,id,valueId,body);}
  @Delete(':kind/:id/values/:valueId')
  removeValue(@Param('kind')kind:'attributes'|'filters',@Param('id')id:string,@Param('valueId')valueId:string,
    @CurrentUser()user:AuthUser):Promise<void>{this.assertPermission(user,kind,'write');return this.catalog.removeValue(kind,id,valueId);}
  @Patch('categories/:id/attributes')
  categoryAttributes(@Param('id')id:string,@Body()body:UpdateCategoryAttributesDto,@CurrentUser()user:AuthUser):Promise<void>{
    this.assertPermission(user,'categories','write');return this.catalog.replaceCategoryAttributes(id,body.attributeIds);}
  private assertPermission(user:AuthUser,kind:string,action:'read'|'write'):void{
    if(!user.permissions.includes(kind+':'+action))throw new ForbiddenException('Insufficient permissions');
  }
}
