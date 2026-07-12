import { Controller, Delete, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PERMISSIONS } from '../rbac/permissions';
import { MediaService } from './media.service';
@Controller('admin/media')
@UseGuards(AccessTokenGuard,PermissionsGuard)
export class MediaController{
  constructor(private readonly media:MediaService){}
  @Get()@RequirePermissions(PERMISSIONS.mediaRead)list(){return this.media.list();}
  @Post()@RequirePermissions(PERMISSIONS.mediaWrite)@UseInterceptors(FileInterceptor('file',{limits:{fileSize:15*1024*1024}}))
  upload(@UploadedFile()file:Express.Multer.File,@CurrentUser()user:AuthUser){return this.media.upload(file,user.id);}
  @Delete(':id')@RequirePermissions(PERMISSIONS.mediaWrite)remove(@Param('id')id:string){return this.media.remove(id);}
}
