ALTER TABLE quote_carts
  ADD COLUMN is_suspicious BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN suspicion_reason VARCHAR(100),
  ADD COLUMN archived_at TIMESTAMPTZ;

ALTER TABLE quote_request_items
  ADD COLUMN category_id_snapshot UUID,
  ADD COLUMN category_title_snapshot VARCHAR(255),
  ADD COLUMN brand_id_snapshot UUID,
  ADD COLUMN brand_title_snapshot VARCHAR(255);

UPDATE quote_request_items i SET
  category_id_snapshot = p.category_id,
  category_title_snapshot = c.title_ar,
  brand_id_snapshot = p.brand_id,
  brand_title_snapshot = b.title_ar
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN brands b ON b.id = p.brand_id
WHERE p.id = i.product_id;

CREATE INDEX quote_carts_maintenance_idx ON quote_carts(status, archived_at, expires_at);
CREATE INDEX quote_carts_visitor_created_idx ON quote_carts(visitor_id, created_at DESC) WHERE visitor_id IS NOT NULL;
CREATE INDEX quote_request_items_category_snapshot_idx ON quote_request_items(category_id_snapshot);
CREATE INDEX quote_request_items_brand_snapshot_idx ON quote_request_items(brand_id_snapshot);
