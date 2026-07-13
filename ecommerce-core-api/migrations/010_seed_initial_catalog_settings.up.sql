CREATE TABLE catalog_settings (
  setting_key VARCHAR(120) PRIMARY KEY,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO catalog_settings(setting_key, setting_value) VALUES
  ('catalog.languages','["ar","en"]'::jsonb),
  ('catalog.defaultPageSize','24'::jsonb),
  ('catalog.modelComparisonLimit','4'::jsonb),
  ('catalog.imageFormats','["webp","avif"]'::jsonb),
  ('quote.requestPrefix','"RFQ"'::jsonb);

INSERT INTO categories(external_key,catalog_code,title_ar,title_en,slug,sort_order) VALUES
  ('part-1','PART 1','معدات الطهي','Cooking Equipment','cooking-equipment',1),
  ('part-2','PART 2','تحضير الطعام','Food Preparation','food-preparation',2);

INSERT INTO categories(external_key,parent_id,title_ar,title_en,slug,sort_order)
SELECT value.external_key,parent.id,value.title_ar,value.title_en,value.slug,value.sort_order
FROM (VALUES
  ('floor-cooking','part-1','مجموعة الطهي الأرضية','Floor Type Cooking Group','floor-type-cooking',1),
  ('table-cooking','part-1','مجموعة الطهي المكتبية','Table Top Cooking Group','table-top-cooking',2),
  ('food-machines','part-2','آلات تجهيز الطعام','Food Preparation Machines','food-preparation-machines',1)
) AS value(external_key,parent_key,title_ar,title_en,slug,sort_order)
JOIN categories parent ON parent.external_key=value.parent_key;

INSERT INTO brands(external_key,title_ar,title_en,slug) VALUES
  ('marhomy','المرهمي','Al Marhomy','al-marhomy');

INSERT INTO specification_definitions(slug,name_ar,name_en,value_type,unit_ar,unit_en,is_filterable,is_comparable,sort_order) VALUES
  ('voltage','الجهد','Voltage','text','فولت','V',TRUE,TRUE,1),
  ('power','القدرة','Power','text','كيلوواط','kW',TRUE,TRUE,2),
  ('net-weight','الوزن الصافي','Net weight','number','كجم','Kg',TRUE,TRUE,3),
  ('cutting-thickness','سماكة التقطيع','Cutting thickness','range','مم','mm',TRUE,TRUE,4),
  ('output','الإنتاجية','Output','number','كجم/ساعة','Kg/h',TRUE,TRUE,5),
  ('dimensions','الأبعاد','Dimensions','text','مم','mm',FALSE,TRUE,6),
  ('fuel-type','نوع التشغيل','Fuel type','option',NULL,NULL,TRUE,TRUE,7),
  ('capacity','السعة','Capacity','number','لتر','L',TRUE,TRUE,8),
  ('material','الخامة','Material','text',NULL,NULL,TRUE,TRUE,9),
  ('frequency','التردد','Frequency','number','هرتز','Hz',TRUE,TRUE,10);

INSERT INTO specification_options(specification_id,value_key,label_ar,label_en,sort_order)
SELECT id,'electric','كهرباء','Electric',1 FROM specification_definitions WHERE slug='fuel-type'
UNION ALL SELECT id,'gas','غاز','Gas',2 FROM specification_definitions WHERE slug='fuel-type';

INSERT INTO category_specifications(category_id,specification_id,is_required,is_filterable_override,is_comparable_override,sort_order)
SELECT c.id,s.id,s.slug IN ('voltage','power'),NULL,NULL,s.sort_order
FROM categories c CROSS JOIN specification_definitions s
WHERE c.external_key IN ('floor-cooking','table-cooking','food-machines');

INSERT INTO products(external_key,primary_category_id,brand_id,title_ar,title_en,slug,
  short_description_ar,short_description_en,status,quote_enabled,is_featured,sort_order)
SELECT p.external_key,c.id,b.id,p.title_ar,p.title_en,p.slug,p.short_ar,p.short_en,'draft',TRUE,p.featured,p.sort_order
FROM (VALUES
  ('meat-cutter','food-machines','قطاعة لحوم','Meat Cutter','meat-cutter','قطاعة لحوم صناعية متعددة الموديلات','Industrial multi-model meat cutter',TRUE,1),
  ('bone-saw','food-machines','منشار عظام','Bone Saw','bone-saw','منشار عظام للاستخدام المهني','Professional bone saw',TRUE,2),
  ('gas-range','floor-cooking','موقد غاز أرضي','Gas Range','gas-range','موقد غاز صناعي','Industrial gas range',FALSE,1),
  ('hot-plate','table-cooking','سطح تسخين','Hot Plate Cooker','hot-plate-cooker','سطح تسخين مكتبي','Table-top hot plate',FALSE,2),
  ('griddle','table-cooking','صاج شوي','Griddle','griddle','صاج شوي للمطابخ التجارية','Commercial kitchen griddle',FALSE,3)
) AS p(external_key,category_key,title_ar,title_en,slug,short_ar,short_en,featured,sort_order)
JOIN categories c ON c.external_key=p.category_key
CROSS JOIN brands b WHERE b.external_key='marhomy';

INSERT INTO product_models(product_id,model_code,title_ar,title_en,sku,availability_status,
  unit_of_measure,minimum_request_quantity,maximum_request_quantity,quantity_step,is_default,is_active,sort_order,
  datasheet_url,manual_url)
SELECT p.id,
  CASE p.external_key
    WHEN 'meat-cutter' THEN (ARRAY['GT-QSJT','GT-QSJA','GT-QSJS','GT-DL'])[n]
    WHEN 'bone-saw' THEN 'GT-BS-'||n
    WHEN 'gas-range' THEN 'GT-GR-'||n
    WHEN 'hot-plate' THEN 'GT-HP-'||n
    ELSE 'GT-GD-'||n END,
  NULL,NULL,
  CASE p.external_key
    WHEN 'meat-cutter' THEN (ARRAY['GT-QSJT','GT-QSJA','GT-QSJS','GT-DL'])[n]
    ELSE UPPER(REPLACE(p.external_key,'-',''))||'-'||n END,
  CASE WHEN n=4 THEN 'available_on_request' ELSE 'available' END,
  'piece',1,CASE WHEN n=4 THEN 20 ELSE NULL END,1,n=1,TRUE,n,
  'https://example.com/catalog/'||p.external_key||'-'||n||'-datasheet.pdf',
  'https://example.com/catalog/'||p.external_key||'-'||n||'-manual.pdf'
FROM products p CROSS JOIN generate_series(1,4) AS n;

INSERT INTO product_images(product_id,image_url,alt_text_ar,alt_text_en,is_primary,sort_order)
SELECT id,'https://placehold.co/1200x900/webp?text='||slug,title_ar,title_en,TRUE,1 FROM products;

INSERT INTO product_model_images(model_id,image_url,alt_text_ar,alt_text_en,is_primary,sort_order)
SELECT m.id,'https://placehold.co/1200x900/webp?text='||m.model_code,
  p.title_ar||' '||m.model_code,p.title_en||' '||m.model_code,TRUE,1
FROM product_models m JOIN products p ON p.id=m.product_id;

INSERT INTO product_model_specification_values(model_id,specification_id,value_text_ar,value_text_en,display_value_ar,display_value_en,sort_order)
SELECT m.id,s.id,'220V / 50–60Hz','220V / 50–60Hz','220V / 50–60Hz','220V / 50–60Hz',s.sort_order
FROM product_models m JOIN specification_definitions s ON s.slug='voltage'
UNION ALL
SELECT m.id,s.id,(0.35+m.sort_order*0.2)::text,(0.35+m.sort_order*0.2)::text,
  (0.35+m.sort_order*0.2)::text,(0.35+m.sort_order*0.2)::text,s.sort_order
FROM product_models m JOIN specification_definitions s ON s.slug='power'
UNION ALL
SELECT m.id,s.id,'440×460×550','440×460×550','440×460×550','440×460×550',s.sort_order
FROM product_models m JOIN specification_definitions s ON s.slug='dimensions';

INSERT INTO product_model_specification_values(model_id,specification_id,value_number,display_value_ar,display_value_en,sort_order)
SELECT m.id,s.id,45+m.sort_order*12,(45+m.sort_order*12)::text,(45+m.sort_order*12)::text,s.sort_order
FROM product_models m JOIN specification_definitions s ON s.slug='net-weight'
UNION ALL
SELECT m.id,s.id,150+m.sort_order*125,(150+m.sort_order*125)::text,(150+m.sort_order*125)::text,s.sort_order
FROM product_models m JOIN specification_definitions s ON s.slug='output'
UNION ALL
SELECT m.id,s.id,50,'50','50',s.sort_order
FROM product_models m JOIN specification_definitions s ON s.slug='frequency';

INSERT INTO product_model_specification_values(model_id,specification_id,value_number,value_number_to,display_value_ar,display_value_en,sort_order)
SELECT m.id,s.id,2.5,5+m.sort_order*5,'2.5–'||(5+m.sort_order*5),'2.5–'||(5+m.sort_order*5),s.sort_order
FROM product_models m JOIN specification_definitions s ON s.slug='cutting-thickness';

INSERT INTO product_model_specification_values(model_id,specification_id,option_id,display_value_ar,display_value_en,sort_order)
SELECT m.id,s.id,o.id,o.label_ar,o.label_en,s.sort_order
FROM product_models m
JOIN specification_definitions s ON s.slug='fuel-type'
JOIN specification_options o ON o.specification_id=s.id AND o.value_key=CASE WHEN m.model_code LIKE 'GT-GR-%' THEN 'gas' ELSE 'electric' END;

UPDATE products SET status='published',published_at=NOW();
