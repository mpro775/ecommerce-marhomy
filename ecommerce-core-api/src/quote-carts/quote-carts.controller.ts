import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AddQuoteCartItemDto, CreateQuoteCartDto, UpdateQuoteCartItemDto } from './dto';
import { QuoteCartsService } from './quote-carts.service';
@Controller('quote-cart')
@Throttle({default:{limit:60,ttl:60000}})
export class QuoteCartsController {
  constructor(private readonly carts:QuoteCartsService){}
  @Post() create(@Body()body:CreateQuoteCartDto){return this.carts.create(body);}
  @Get() get(@Headers('x-quote-cart-token')token:string){return this.carts.get(token);}
  @Post('items') add(@Headers('x-quote-cart-token')token:string,@Body()body:AddQuoteCartItemDto){return this.carts.add(token,body);}
  @Patch('items/:itemId') update(@Headers('x-quote-cart-token')token:string,@Param('itemId')itemId:string,@Body()body:UpdateQuoteCartItemDto){return this.carts.update(token,itemId,body);}
  @Delete('items/:itemId') remove(@Headers('x-quote-cart-token')token:string,@Param('itemId')itemId:string){return this.carts.remove(token,itemId);}
  @Delete() clear(@Headers('x-quote-cart-token')token:string){return this.carts.clear(token);}
}
