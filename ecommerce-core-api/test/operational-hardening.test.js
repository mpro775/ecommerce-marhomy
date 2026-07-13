const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('application product deletion only archives products',()=>{
  const service=fs.readFileSync(path.join(root,'src','products','products.service.ts'),'utf8');
  const remove=service.slice(service.indexOf('async remove('),service.indexOf('async related('));
  assert.match(remove,/status='archived'/);
  assert.match(remove,/quote_enabled=false/);
  assert.doesNotMatch(remove,/DELETE FROM products/);
});

test('cart product references are migrated from cascade to restrict',()=>{
  const hardening=fs.readFileSync(path.join(root,'migrations','012_harden_product_deletion_and_idempotency.up.sql'),'utf8');
  assert.match(hardening,/DROP CONSTRAINT quote_cart_items_product_id_fkey/);
  assert.match(hardening,/FOREIGN KEY\(product_id\) REFERENCES products\(id\) ON DELETE RESTRICT/);
});

test('expired idempotency keys have periodic cleanup and an expiry index',()=>{
  const cleanup=fs.readFileSync(path.join(root,'src','quote-requests','idempotency-key-cleanup.service.ts'),'utf8');
  const worker=fs.readFileSync(path.join(root,'src','workers','idempotency-key-cleanup.worker.ts'),'utf8');
  const migration=fs.readFileSync(path.join(root,'migrations','012_harden_product_deletion_and_idempotency.up.sql'),'utf8');
  assert.match(cleanup,/DELETE FROM idempotency_keys WHERE expires_at<=NOW\(\)/);
  assert.match(cleanup,/pg_try_advisory_xact_lock/);
  assert.match(worker,/setInterval/);
  assert.match(migration,/idempotency_keys_expiry_idx/);
});

test('fresh migration is guarded in production and database defaults agree',()=>{
  const fresh=fs.readFileSync(path.join(root,'scripts','migrate-fresh.mjs'),'utf8');
  const migrate=fs.readFileSync(path.join(root,'scripts','migrate.mjs'),'utf8');
  assert.match(fresh,/NODE_ENV==='production'/);
  assert.match(fresh,/ALLOW_DESTRUCTIVE_MIGRATION!=='true'/);
  assert.match(fresh,/migrate:fresh is disabled in production/);
  assert.match(fresh,/ecommerce_core_rfq/);
  assert.match(migrate,/ecommerce_core_rfq/);
  assert.doesNotMatch(migrate,/ecommerce_core_store/);
});
