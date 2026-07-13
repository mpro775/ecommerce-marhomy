const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const service=fs.readFileSync(path.resolve(__dirname,'../src/quote-requests/quote-requests.service.ts'),'utf8');
test('submission is a single transaction with locking and idempotency',()=>{
  assert.match(service,/database\.transaction/);assert.match(service,/FOR UPDATE/);assert.match(service,/idempotency_keys/);
  assert.match(service,/request_hash/);assert.match(service,/pg_advisory_xact_lock/);assert.match(service,/Quote cart is empty/);
  assert.match(service,/DELETE FROM idempotency_keys[\s\S]*expires_at<=NOW\(\)/);
});
test('submission stores snapshots, closes cart, creates history and durable event',()=>{
  assert.match(service,/quote_request_items/);assert.match(service,/product_title_snapshot/);assert.match(service,/attributes_snapshot/);
  assert.match(service,/quote_request_status_history/);assert.match(service,/status='submitted'/);assert.match(service,/outbox_events/);
});
test('public tracking requires both request number and an opaque token',()=>{
  assert.match(service,/request_number=\$1 AND public_token=\$2/);
});
test('contact upsert and request year are concurrency and timezone safe',()=>{
  assert.match(service,/ON CONFLICT\(phone\) DO UPDATE/);
  assert.match(service,/APP_TIMEZONE/);assert.match(service,/timezone\(\$1,CURRENT_TIMESTAMP\)/);
  assert.doesNotMatch(service,/getUTCFullYear/);
});
test('note side effects share one database transaction',()=>{
  const noteMethod=service.slice(service.indexOf('async note('),service.indexOf('async history('));
  assert.match(noteMethod,/database\.transaction/);assert.doesNotMatch(noteMethod,/this\.database\.query/);
  for(const table of ['quote_request_notes','notifications','notification_recipients','notification_deliveries','audit_logs'])
    assert.match(noteMethod,new RegExp(table));
});
test('export query has no pagination limit and details expose allowed transitions',()=>{
  const exportMethod=service.slice(service.indexOf('async exportWorkbook('),service.indexOf('async contacts('));
  assert.doesNotMatch(exportMethod,/pageSize|LIMIT|OFFSET/);
  assert.match(service,/allowedTransitions:allowedStatusTransitions/);
});
