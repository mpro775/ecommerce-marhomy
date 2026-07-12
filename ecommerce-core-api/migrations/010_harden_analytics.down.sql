DROP INDEX IF EXISTS quote_request_items_brand_snapshot_idx, quote_request_items_category_snapshot_idx,
  quote_carts_visitor_created_idx, quote_carts_maintenance_idx;
ALTER TABLE quote_request_items DROP COLUMN IF EXISTS brand_title_snapshot, DROP COLUMN IF EXISTS brand_id_snapshot,
  DROP COLUMN IF EXISTS category_title_snapshot, DROP COLUMN IF EXISTS category_id_snapshot;
ALTER TABLE quote_carts DROP COLUMN IF EXISTS archived_at, DROP COLUMN IF EXISTS suspicion_reason,
  DROP COLUMN IF EXISTS is_suspicious;
