import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
const allowed:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4'};
@Injectable()
export class MediaService{
  private readonly client:S3Client;private readonly bucket:string;private readonly publicUrl:string;
  constructor(private readonly database:DatabaseService,config:ConfigService){
    this.bucket=config.getOrThrow<string>('STORAGE_BUCKET');this.publicUrl=config.getOrThrow<string>('STORAGE_PUBLIC_URL').replace(/\/$/,'');
    this.client=new S3Client({endpoint:config.getOrThrow<string>('S3_ENDPOINT'),region:config.get<string>('S3_REGION','us-east-1'),
      forcePathStyle:config.get<boolean>('S3_FORCE_PATH_STYLE',true),credentials:{accessKeyId:config.getOrThrow<string>('S3_ACCESS_KEY'),
      secretAccessKey:config.getOrThrow<string>('S3_SECRET_KEY')}});
  }
  async upload(file:Express.Multer.File,userId:string):Promise<unknown>{
    const extension=allowed[file.mimetype];if(!extension)throw new BadRequestException('Unsupported media type');
    if(!file.buffer?.length)throw new BadRequestException('Media file is empty');
    const key='catalog/'+new Date().toISOString().slice(0,7)+'/'+randomUUID()+'.'+extension;
    await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:key,Body:file.buffer,ContentType:file.mimetype,
      CacheControl:'public, max-age=31536000, immutable'}));
    return(await this.database.query(`INSERT INTO media_assets(object_key,public_url,mime_type,byte_size,created_by_admin_user_id)
      VALUES($1,$2,$3,$4,$5) RETURNING *`,[key,this.publicUrl+'/'+key,file.mimetype,file.size,userId])).rows[0];
  }
  async list():Promise<unknown[]>{return(await this.database.query('SELECT * FROM media_assets ORDER BY created_at DESC LIMIT 200')).rows;}
  async remove(id:string):Promise<void>{
    const result=await this.database.query<{object_key:string}>('DELETE FROM media_assets WHERE id=$1 RETURNING object_key',[id]);
    if(!result.rows[0])throw new NotFoundException('Media asset not found');
    await this.client.send(new DeleteObjectCommand({Bucket:this.bucket,Key:result.rows[0].object_key}));
  }
}
