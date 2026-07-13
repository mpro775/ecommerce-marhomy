import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { prepareMedia } from './media.processor';
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
    const media=await prepareMedia(file?.buffer??Buffer.alloc(0));
    const key='catalog/'+new Date().toISOString().slice(0,7)+'/'+randomUUID()+'.'+media.extension;
    await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:key,Body:media.buffer,ContentType:media.mimeType,
      CacheControl:'public, max-age=31536000, immutable'}));
    try{
      return(await this.database.query(`INSERT INTO media_assets(object_key,public_url,mime_type,byte_size,created_by_admin_user_id)
        VALUES($1,$2,$3,$4,$5) RETURNING *`,[key,this.publicUrl+'/'+key,media.mimeType,media.buffer.length,userId])).rows[0];
    }catch(error){
      try{await this.client.send(new DeleteObjectCommand({Bucket:this.bucket,Key:key}));}catch{/** Keep the original database error. */}
      throw error;
    }
  }
  async list():Promise<unknown[]>{return(await this.database.query("SELECT * FROM media_assets WHERE deletion_status='active' ORDER BY created_at DESC LIMIT 200")).rows;}
  async remove(id:string):Promise<void>{
    const asset=await this.database.transaction(async client=>{
      const result=await client.query<{object_key:string;public_url:string;deletion_status:string}>(
        'SELECT object_key,public_url,deletion_status FROM media_assets WHERE id=$1 FOR UPDATE',[id]);
      const row=result.rows[0];if(!row)throw new NotFoundException('Media asset not found');
      const references=await client.query<{source:string}>(`SELECT 'product' AS source FROM product_images
        WHERE media_asset_id=$1 OR image_url=$2
        UNION ALL SELECT 'product model' FROM product_model_images WHERE media_asset_id=$1 OR image_url=$2
        UNION ALL SELECT 'category' FROM categories WHERE image_url=$2
        UNION ALL SELECT 'brand' FROM brands WHERE logo_url=$2 LIMIT 1`,[id,row.public_url]);
      if(references.rows[0])throw new ConflictException(`Media asset is still used by a ${references.rows[0].source}`);
      if(row.deletion_status==='active')await client.query(
        "UPDATE media_assets SET deletion_status='pending_delete',pending_delete_at=NOW() WHERE id=$1",[id]);
      return row;
    });
    await this.client.send(new DeleteObjectCommand({Bucket:this.bucket,Key:asset.object_key}));
    await this.database.query("DELETE FROM media_assets WHERE id=$1 AND deletion_status='pending_delete'",[id]);
  }
}
