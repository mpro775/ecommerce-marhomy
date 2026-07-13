import { Controller, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PERMISSIONS } from '../rbac/permissions';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { CatalogImportService } from './catalog-import.service';

@Controller('admin/catalog-import')
@UseGuards(AccessTokenGuard,PermissionsGuard)
export class CatalogImportController {
  constructor(private readonly imports:CatalogImportService){}
  @Get('template') @RequirePermissions(PERMISSIONS.catalogImportsRead) async template(@Res()response:Response){response.setHeader('content-type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');response.setHeader('content-disposition','attachment; filename=catalog-import-template.xlsx');response.send(await this.imports.template());}
  @Get('export') @RequirePermissions(PERMISSIONS.catalogImportsRead) async export(@Res()response:Response){response.setHeader('content-type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');response.setHeader('content-disposition','attachment; filename=catalog-export.xlsx');response.send(await this.imports.exportWorkbook());}
  @Post('validate') @RequirePermissions(PERMISSIONS.catalogImportsWrite) @UseInterceptors(FileInterceptor('file',{limits:{fileSize:100*1024*1024}}))
  validate(@UploadedFile()file:Express.Multer.File,@CurrentUser()user:AuthUser){return this.imports.validate(file,user.id);}
  @Post('execute') @RequirePermissions(PERMISSIONS.catalogImportsWrite) @UseInterceptors(FileInterceptor('file',{limits:{fileSize:100*1024*1024}}))
  execute(@UploadedFile()file:Express.Multer.File,@CurrentUser()user:AuthUser){return this.imports.execute(file,user.id);}
  @Get('history') @RequirePermissions(PERMISSIONS.catalogImportsRead) history(){return this.imports.history();}
  @Get(':id/report') @RequirePermissions(PERMISSIONS.catalogImportsRead) report(@Param('id')id:string){return this.imports.report(id);}
}
