import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
@Injectable()
export class EmailService{
  private readonly logger=new Logger(EmailService.name);private readonly transporter:Transporter|null;
  constructor(private readonly config:ConfigService){
    this.transporter=config.get<string>('EMAIL_DELIVERY_MODE','log')==='smtp'?nodemailer.createTransport({
      host:config.get<string>('SMTP_HOST'),port:config.get<number>('SMTP_PORT',465),
      secure:config.get<boolean>('SMTP_SECURE',true),auth:{user:config.get<string>('SMTP_USER'),pass:config.get<string>('SMTP_PASSWORD')}}):null;
  }
  async send(to:string[],subject:string,text:string):Promise<void>{
    if(!to.length)return;if(!this.transporter){this.logger.log('Email '+subject+' -> '+to.join(','));return;}
    await this.transporter.sendMail({from:this.config.get<string>('EMAIL_FROM'),to:to.join(','),subject,text});
  }
}
