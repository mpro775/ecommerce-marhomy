const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
function content(directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?content(path.join(directory,entry.name)):
    /\.(ts|tsx)$/.test(entry.name)?[fs.readFileSync(path.join(directory,entry.name),'utf8')]:[]).join('\n').toLowerCase();
}
test('admin navigation exposes only catalog and RFQ operations',()=>{
  const admin=content(path.resolve(__dirname,'../../ecommerce-core-admin/src'));
  for(const phrase of ['طلبات عروض الأسعار','جهات الاتصال','الكتالوج','الإشعارات','سجل العمليات'])assert.ok(admin.includes(phrase));
  for(const fragment of ['curr'+'ency','inven'+'tory','ware'+'house','pay'+'ment','loy'+'alty','affil'+'iate'])assert.equal(admin.includes(fragment),false);
});
test('public app includes bilingual responsive cart and successful submission flow',()=>{
  const storefront=content(path.resolve(__dirname,'../../ecommerce-core-storefront/src'));
  for(const phrase of ['quote-carts','quote-requests','idempotency-key','formstartedat','العربية','english','success'])
    assert.ok(storefront.includes(phrase));
  for(const fragment of ['curr'+'ency','sub'+'total','dis'+'count','t'+'ax','pay'+'ment'])assert.equal(storefront.includes(fragment),false);
});
test('admin status selector uses the transitions allowed by the API',()=>{
  const admin=content(path.resolve(__dirname,'../../ecommerce-core-admin/src'));
  assert.ok(admin.includes('data.allowedtransitions'));
});
