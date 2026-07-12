import { BadRequestException } from '@nestjs/common';
export const QUOTE_STATUSES=['new','in_review','contacted','quote_sent','accepted','rejected','cancelled','closed'] as const;
export type QuoteStatus=typeof QUOTE_STATUSES[number];
const transitions:Record<QuoteStatus,readonly QuoteStatus[]>={
  new:['in_review','cancelled'],in_review:['contacted','rejected','cancelled'],contacted:['quote_sent','rejected','cancelled'],
  quote_sent:['accepted','rejected','cancelled'],accepted:['closed'],rejected:['closed'],cancelled:['closed'],closed:[]};
export function assertStatusTransition(current:QuoteStatus,next:QuoteStatus):void{
  if(!transitions[current].includes(next))throw new BadRequestException('Status transition from '+current+' to '+next+' is not allowed');
}
export function assertQuoteQuantity(quantity:number,minimum:number,maximum:number|null,step:number):void{
  if(!Number.isFinite(quantity)||quantity<=0)throw new BadRequestException('Quantity must be greater than zero');
  if(quantity<minimum-0.000001)throw new BadRequestException('Quantity must be at least '+minimum);
  if(maximum!==null&&quantity>maximum+0.000001)throw new BadRequestException('Quantity must not exceed '+maximum);
  const steps=(quantity-minimum)/step;if(Math.abs(steps-Math.round(steps))>0.0001)throw new BadRequestException('Quantity must follow step '+step);
}
export function sanitizeText(value:string|undefined|null,maxLength:number):string|null{
  if(!value)return null;
  const withoutMarkup=value.replace(/<[^>]*>/g,'');
  const normalized=Array.from(withoutMarkup).map((character)=>{
    const code=character.charCodeAt(0);return(code<=31||code===127)?' ':character;
  }).join('').trim();
  return normalized.slice(0,maxLength)||null;
}
export function assertSpamSafe(note:string|null):void{
  if((note?.match(/https?:\/\/|www\./gi)?.length??0)>2)throw new BadRequestException('Too many links in note');
}
