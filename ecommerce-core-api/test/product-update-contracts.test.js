require('reflect-metadata');
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateSync}=require('class-validator');
const {UpdateProductDto}=require('../dist/products/dto.js');
const {ProductsService}=require('../dist/products/products.service.js');
const {QuoteCartsService}=require('../dist/quote-carts/quote-carts.service.js');

test('product PATCH accepts a genuinely partial payload',()=>{
  const input=Object.assign(new UpdateProductDto(),{isFeatured:true});
  assert.deepEqual(validateSync(input),[]);
});

test('product merge preserves omitted fields and explicit null',()=>{
  const service=new ProductsService({});
  const row={category_id:'category',brand_id:'brand',title_ar:'منتج',title_en:'Product',slug:'product',short_description_ar:null,
    short_description_en:'Description',detailed_description_ar:null,detailed_description_en:null,model_code:null,sku:'SKU-1',barcode:'123',youtube_url:null,
    tags:[],is_featured:false,status:'draft',sort_order:0,seo_title_ar:null,seo_title_en:null,seo_description_ar:null,seo_description_en:null,
    quote_enabled:true,availability_status:'available',unit_of_measure:'piece',minimum_request_quantity:'1',maximum_request_quantity:'10',quantity_step:'1',specifications:{}};
  const merged=service.fromRow(row,{brandId:null,sku:'',maximumRequestQuantity:null});
  assert.equal(merged.categoryId,'category');
  assert.equal(merged.brandId,null);
  assert.equal(merged.sku,'');
  assert.equal(merged.maximumRequestQuantity,null);
});

test('cart variant rule auto-selects only one active default and otherwise requires a choice',async()=>{
  const service=new QuoteCartsService({},{});
  const singleDb={query:async()=>({rows:[{id:'default-id',is_default:true}]})};
  assert.equal(await service.resolveSelectableVariant(singleDb,'product-id'), 'default-id');
  const multipleDb={query:async()=>({rows:[{id:'one',is_default:true},{id:'two',is_default:false}]})};
  await assert.rejects(()=>service.resolveSelectableVariant(multipleDb,'product-id'),/variant must be selected/i);
});
