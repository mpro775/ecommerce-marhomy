import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AddQuoteCartItemDto, CreateQuoteCartDto, UpdateQuoteCartItemDto } from './dto';
import { QuoteCartsService } from './quote-carts.service';
@Controller('quote-carts')
@Throttle({default:{limit:60,ttl:60000}})
export class QuoteCartsController{
  constructor(private readonly carts:QuoteCartsService){}
  @Post()create(@Body()body:CreateQuoteCartDto){return this.carts.create(body);}
  @Get(':token')get(@Param('token')token:string){return this.carts.get(token);}
  @Post(':token/items')add(@Param('token')token:string,@Body()body:AddQuoteCartItemDto){return this.carts.add(token,body);}
  @Patch(':token/items/:itemId')update(@Param('token')token:string,@Param('itemId')itemId:string,@Body()body:UpdateQuoteCartItemDto){
    return this.carts.update(token,itemId,body);}
  @Delete(':token/items/:itemId')remove(@Param('token')token:string,@Param('itemId')itemId:string){return this.carts.remove(token,itemId);}
  @Delete(':token/items')clear(@Param('token')token:string){return this.carts.clear(token);}
}
