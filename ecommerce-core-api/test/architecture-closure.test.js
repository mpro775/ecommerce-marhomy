const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function files(directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):[path.join(directory,entry.name)]);
}
function source(){
  return files(path.join(root,'src')).filter(file=>/\.(ts|tsx|sql)$/.test(file)).map(file=>fs.readFileSync(file,'utf8')).join('\n');
}
test('backend contains only the final RFQ domain modules',()=>{
  const directories=fs.readdirSync(path.join(root,'src'),{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
  assert.deepEqual(directories,['analytics','audit','auth','catalog','common','config','database','email','health','media','notifications',
    'outbox','products','quote-carts','quote-requests','rbac','team','workers']);
});
test('source has no tenant, financial, fulfillment, or stock domain remnants',()=>{
  const content=source();const fragments=['store'+'_id','store'+'Id','ten'+'ant','pri'+'ce','curr'+'ency','sub'+'total','dis'+'count',
    't'+'ax','inven'+'tory','ware'+'house','ship'+'ment','pay'+'ment','cou'+'pon','loy'+'alty','affil'+'iate','aban'+'doned'];
  for(const fragment of fragments)assert.equal(content.toLowerCase().includes(fragment.toLowerCase()),false,'found '+fragment);
});
test('baseline consists of eight ordered reversible migrations',()=>{
  const names=fs.readdirSync(path.join(root,'migrations'));const up=names.filter(name=>name.endsWith('.up.sql')).sort();
  const down=names.filter(name=>name.endsWith('.down.sql')).sort();assert.equal(up.length,8);assert.equal(down.length,8);
  assert.deepEqual(up.map(name=>name.slice(0,3)),['001','002','003','004','005','006','007','008']);
  for(const name of up)assert.ok(names.includes(name.replace('.up.sql','.down.sql')));
});
test('catalog schema uses descriptive request fields and decimal quantity rules',()=>{
  const catalog=fs.readFileSync(path.join(root,'migrations','002_create_catalog.up.sql'),'utf8');
  assert.match(catalog,/availability_status/);assert.match(catalog,/unit_of_measure/);assert.match(catalog,/NUMERIC\(14,3\)/);
  assert.match(catalog,/quote_enabled/);assert.doesNotMatch(catalog,/store_id|currency_code|compare_at_price|stock_quantity/i);
});
test('submitted request snapshots survive later catalog deletion',()=>{
  const carts=fs.readFileSync(path.join(root,'migrations','003_create_quote_carts.up.sql'),'utf8');
  const requests=fs.readFileSync(path.join(root,'migrations','004_create_quote_requests.up.sql'),'utf8');
  assert.match(carts,/product_id UUID NOT NULL REFERENCES products\(id\) ON DELETE CASCADE/);
  assert.match(requests,/product_id UUID REFERENCES products\(id\) ON DELETE SET NULL/);
  assert.match(requests,/variant_id UUID REFERENCES product_variants\(id\) ON DELETE SET NULL/);
});
