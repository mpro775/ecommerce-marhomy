const test=require('node:test');
const assert=require('node:assert/strict');
const {mapPostgresError}=require('../dist/common/filters/postgres-error.mapper.js');

test('maps common PostgreSQL data errors to safe client responses',()=>{
  assert.deepEqual(mapPostgresError({code:'23505',constraint:'products_slug_key'}),{status:409,message:'هذا الرابط مستخدم مسبقًا'});
  assert.deepEqual(mapPostgresError({code:'23505',constraint:'product_variants_sku_key'}),{status:409,message:'SKU مستخدم مسبقًا'});
  assert.deepEqual(mapPostgresError({code:'23503',constraint:'products_category_id_fkey'}),{status:400,message:'التصنيف المحدد غير موجود أو لم يعد متاحًا'});
  assert.equal(mapPostgresError(new Error('unrelated')),null);
});
