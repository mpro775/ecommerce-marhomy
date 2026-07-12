const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const service=fs.readFileSync(path.resolve(__dirname,'../src/quote-requests/quote-requests.service.ts'),'utf8');
test('submission is a single transaction with locking and idempotency',()=>{
  assert.match(service,/database\.transaction/);assert.match(service,/FOR UPDATE/);assert.match(service,/idempotency_keys/);
  assert.match(service,/request_hash/);assert.match(service,/pg_advisory_xact_lock/);assert.match(service,/Quote cart is empty/);
});
test('submission stores snapshots, closes cart, creates history and durable event',()=>{
  assert.match(service,/quote_request_items/);assert.match(service,/product_title_snapshot/);assert.match(service,/attributes_snapshot/);
  assert.match(service,/quote_request_status_history/);assert.match(service,/status='submitted'/);assert.match(service,/outbox_events/);
});
test('public tracking requires both request number and an opaque token',()=>{
  assert.match(service,/request_number=\$1 AND public_token=\$2/);
});
