const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=(file)=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');
test('HTTP boundary enables validation hardening and safe defaults',()=>{
  const main=read('src/main.ts');assert.match(main,/whitelist:true/);assert.match(main,/forbidNonWhitelisted:true/);
  assert.match(main,/helmet\(\)/);assert.match(main,/ALLOWED_ORIGINS/);assert.match(main,/HTTP_JSON_BODY_LIMIT/);
});
test('public submission includes throttling, honeypot, timing, phone, and text defenses',()=>{
  const controller=read('src/quote-requests/quote-requests.controller.ts');const dto=read('src/quote-requests/dto.ts');
  const service=read('src/quote-requests/quote-requests.service.ts');
  assert.match(controller,/limit:5/);assert.match(dto,/website/);assert.match(dto,/Matches/);assert.match(service,/QUOTE_MIN_FORM_FILL_MS/);
  assert.match(service,/assertSpamSafe/);assert.match(service,/Idempotency-Key/);
});
test('media upload uses allowlisted content types and byte limits',()=>{
  const media=read('src/media/media.service.ts');const processor=read('src/media/media.processor.ts');const controller=read('src/media/media.controller.ts');
  assert.match(processor,/image\/jpeg/);assert.match(processor,/video\/mp4/);assert.doesNotMatch(processor,/image\/svg/);assert.match(controller,/fileSize/);
  assert.match(processor,/fileTypeFromBuffer/);assert.match(processor,/sharp/);assert.doesNotMatch(media,/file\.mimetype/);
});
test('media deletion checks references and uses a pending state before object deletion',()=>{
  const media=read('src/media/media.service.ts');const migration=read('migrations/009_harden_media_deletion.up.sql');
  assert.match(media,/product_images/);assert.match(media,/pending_delete/);assert.match(media,/DeleteObjectCommand/);
  assert.ok(media.indexOf("deletion_status='pending_delete'")<media.lastIndexOf('DeleteObjectCommand'));
  assert.match(migration,/ensure_product_media_asset_is_active/);assert.match(migration,/FOR SHARE/);
});
test('seed defines the documented least-privilege permissions and roles',()=>{
  const seed=read('migrations/008_seed_roles_permissions.up.sql');
  for(const permission of ['dashboard:read','products:write','quote_requests:assign','quote_requests:export','contacts:read','audit:read'])
    assert.ok(seed.includes(permission));
  for(const role of ['owner','manager','catalog_manager','quote_agent','viewer'])assert.ok(seed.includes("'"+role+"'"));
});
