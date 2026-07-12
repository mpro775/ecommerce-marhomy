import { BadRequestException } from '@nestjs/common';
import { createFile, type MP4BoxBuffer, type Movie } from 'mp4box';
import sharp from 'sharp';

const IMAGE_MIME_TYPES=new Set(['image/jpeg','image/png','image/webp','image/gif']);
const MAX_IMAGE_DIMENSION=4096;
const MAX_IMAGE_PIXELS=40_000_000;
const MAX_VIDEO_BYTES=15*1024*1024;
const MAX_VIDEO_DURATION_SECONDS=120;
const MAX_VIDEO_WIDTH=3840;
const MAX_VIDEO_HEIGHT=2160;
// TypeScript emits require() for dynamic imports in CommonJS builds. Keep the native import
// so the current ESM-only, security-patched file-type release can be used on Node 20.
const loadFileType=new Function('specifier','return import(specifier)') as
  (specifier:string)=>Promise<typeof import('file-type')>;

export interface PreparedMedia{
  buffer:Buffer;
  mimeType:'image/webp'|'video/mp4';
  extension:'webp'|'mp4';
}

export async function prepareMedia(buffer:Buffer):Promise<PreparedMedia>{
  if(!buffer.length)throw new BadRequestException('Media file is empty');
  const detected=await(await loadFileType('file-type')).fileTypeFromBuffer(buffer);
  if(!detected)throw new BadRequestException('Unsupported or unrecognizable media file');
  if(IMAGE_MIME_TYPES.has(detected.mime))return prepareImage(buffer);
  if(detected.mime==='video/mp4')return prepareVideo(buffer);
  throw new BadRequestException('Unsupported media type');
}

async function prepareImage(buffer:Buffer):Promise<PreparedMedia>{
  try{
    const input=sharp(buffer,{animated:true,failOn:'warning',limitInputPixels:MAX_IMAGE_PIXELS});
    const metadata=await input.metadata();
    if(!metadata.width||!metadata.height)throw new Error('Missing image dimensions');
    const pageHeight=metadata.pageHeight??metadata.height;
    const pages=metadata.pages??1;
    if(metadata.width*pageHeight*pages>MAX_IMAGE_PIXELS)throw new Error('Image pixel count exceeds the limit');
    const output=await input.rotate().resize({width:MAX_IMAGE_DIMENSION,height:MAX_IMAGE_DIMENSION,fit:'inside',withoutEnlargement:true})
      .webp({quality:82,effort:4}).toBuffer();
    return{buffer:output,mimeType:'image/webp',extension:'webp'};
  }catch(error){
    if(error instanceof BadRequestException)throw error;
    throw new BadRequestException('Invalid or unsafe image file');
  }
}

async function prepareVideo(buffer:Buffer):Promise<PreparedMedia>{
  if(buffer.length>MAX_VIDEO_BYTES)throw new BadRequestException('Video exceeds the 15 MB limit');
  const info=inspectMp4(buffer);
  const duration=info.timescale>0?info.duration/info.timescale:0;
  if(!Number.isFinite(duration)||duration<=0)throw new BadRequestException('Video duration is invalid');
  if(duration>MAX_VIDEO_DURATION_SECONDS)throw new BadRequestException('Video exceeds the 120 second duration limit');
  if(!info.videoTracks.length)throw new BadRequestException('MP4 file does not contain a video track');
  if(info.videoTracks.some(track=>(track.video?.width??0)>MAX_VIDEO_WIDTH||(track.video?.height??0)>MAX_VIDEO_HEIGHT))
    throw new BadRequestException('Video dimensions exceed 3840x2160');
  return{buffer,mimeType:'video/mp4',extension:'mp4'};
}

function inspectMp4(buffer:Buffer):Movie{
  const file=createFile();
  let info:Movie|undefined;let parseError:string|undefined;
  file.onReady=value=>{info=value;};
  file.onError=(_module,message)=>{parseError=message;};
  const data=buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength) as MP4BoxBuffer;
  data.fileStart=0;
  try{file.appendBuffer(data,true);file.flush();}catch{throw new BadRequestException('Invalid MP4 video file');}
  if(parseError||!info)throw new BadRequestException('Invalid MP4 video file');
  return info;
}
