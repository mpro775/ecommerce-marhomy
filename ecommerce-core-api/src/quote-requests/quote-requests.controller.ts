import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { getRequestContext } from '../common/utils/request-context';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PERMISSIONS } from '../rbac/permissions';
import { CreateQuoteNoteDto, ListQuoteRequestsQuery, SubmitQuoteRequestDto, UpdateAssigneeDto, UpdateContactDto, UpdateQuoteStatusDto } from './dto';
import { QuoteRequestsService } from './quote-requests.service';
@Controller('quote-requests')
export class QuoteRequestsController{
  constructor(private readonly requests:QuoteRequestsService){}
  @Post()@Throttle({default:{limit:5,ttl:60000}})
  submit(@Body()body:SubmitQuoteRequestDto,@Headers('idempotency-key')key:string|undefined,@Req()request:Request){
    return this.requests.submit(body,key??'',getRequestContext(request));}
  @Get('public/:requestNumber')
  status(@Param('requestNumber')requestNumber:string,@Query('token')token:string){return this.requests.publicStatus(requestNumber,token);}
}
@Controller('admin/quote-requests')
@UseGuards(AccessTokenGuard,PermissionsGuard)
export class AdminQuoteRequestsController{
  constructor(private readonly requests:QuoteRequestsService){}
  @Get()@RequirePermissions(PERMISSIONS.quoteRequestsRead)
  list(@Query()query:ListQuoteRequestsQuery){return this.requests.list(query);}
  @Get('export')@RequirePermissions(PERMISSIONS.quoteRequestsExport)
  async export(@Query()query:ListQuoteRequestsQuery,@Res()response:Response):Promise<void>{
    const file=await this.requests.exportWorkbook(query);
    response.setHeader('content-type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('content-disposition','attachment; filename=quote-requests.xlsx');response.send(file);
  }
  @Get(':id')@RequirePermissions(PERMISSIONS.quoteRequestsRead)
  detail(@Param('id')id:string){return this.requests.detail(id);}
  @Patch(':id/status')@RequirePermissions(PERMISSIONS.quoteRequestsWrite)
  status(@Param('id')id:string,@Body()body:UpdateQuoteStatusDto,@CurrentUser()user:AuthUser){return this.requests.updateStatus(id,body,user);}
  @Patch(':id/assignee')@RequirePermissions(PERMISSIONS.quoteRequestsAssign)
  assign(@Param('id')id:string,@Body()body:UpdateAssigneeDto,@CurrentUser()user:AuthUser){return this.requests.assign(id,body,user);}
  @Post(':id/notes')@RequirePermissions(PERMISSIONS.quoteRequestsWrite)
  note(@Param('id')id:string,@Body()body:CreateQuoteNoteDto,@CurrentUser()user:AuthUser){return this.requests.note(id,body,user);}
  @Get(':id/history')@RequirePermissions(PERMISSIONS.quoteRequestsRead)
  history(@Param('id')id:string){return this.requests.history(id);}
}
@Controller('admin/contacts')
@UseGuards(AccessTokenGuard,PermissionsGuard)
export class ContactsController{
  constructor(private readonly requests:QuoteRequestsService){}
  @Get()@RequirePermissions(PERMISSIONS.contactsRead)
  list(@Query('search')search?:string){return this.requests.contacts(search??'');}
  @Get(':id')@RequirePermissions(PERMISSIONS.contactsRead)
  detail(@Param('id')id:string){return this.requests.contact(id);}
  @Patch(':id')@RequirePermissions(PERMISSIONS.contactsWrite)
  update(@Param('id')id:string,@Body()body:UpdateContactDto){return this.requests.updateContact(id,body);}
}
