const test=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const {prepareMedia}=require('../dist/media/media.processor');

test('uploaded images are detected from bytes, resized, and re-encoded without metadata',async()=>{
  const source=await sharp({create:{width:5000,height:20,channels:3,background:'#cc0000'}}).jpeg().withMetadata().toBuffer();
  const result=await prepareMedia(source);
  const metadata=await sharp(result.buffer).metadata();
  assert.equal(result.mimeType,'image/webp');
  assert.equal(result.extension,'webp');
  assert.equal(metadata.format,'webp');
  assert.ok(metadata.width<=4096&&metadata.height<=4096);
  assert.equal(metadata.exif,undefined);
  assert.equal(metadata.icc,undefined);
  assert.equal(metadata.xmp,undefined);
});

test('unrecognized bytes are rejected regardless of a client-provided filename or MIME',async()=>{
  await assert.rejects(()=>prepareMedia(Buffer.from('not really a jpeg image')),/Unsupported or unrecognizable media file/);
});
