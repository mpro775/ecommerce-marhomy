const test=require('node:test');
const assert=require('node:assert/strict');
const {BadRequestException}=require('@nestjs/common');
const {CatalogService}=require('../dist/catalog/catalog.service.js');
const {ProductsService}=require('../dist/products/products.service.js');

test('category update rejects itself and descendants as parents',async()=>{
  const categoryId='11111111-1111-4111-8111-111111111111';
  const descendantId='22222222-2222-4222-8222-222222222222';
  const database={query:async(sql)=>{
    if(sql.includes('WITH RECURSIVE descendants'))return{rows:[{parent_exists:true,is_descendant:true}]};
    throw new Error('category update should stop before writing');
  }};
  const service=new CatalogService(database);
  await assert.rejects(()=>service.update('categories',categoryId,{parentId:categoryId}),BadRequestException);
  await assert.rejects(()=>service.update('categories',categoryId,{parentId:descendantId}),BadRequestException);
});

test('public product list applies numeric minimum and maximum filters',async()=>{
  const queries=[];const database={query:async(sql,values)=>{queries.push({sql,values});return sql.includes('COUNT(')?{rows:[{count:'0'}]}:{rows:[]};}};
  const service=new ProductsService(database);
  const filterId='33333333-3333-4333-8333-333333333333';
  await service.publicList({filterRanges:`${filterId}:10.5:20`,page:1,pageSize:24});
  assert.match(queries[0].sql,/product_filter_ranges/);
  assert.match(queries[0].sql,/range_value >=/);
  assert.match(queries[0].sql,/range_value <=/);
  assert.deepEqual(queries[0].values.slice(0,3),[filterId,10.5,20]);
  await assert.rejects(()=>service.publicList({filterRanges:`${filterId}:20:10`}),BadRequestException);
});
