DROP TRIGGER IF EXISTS trg_product_images_active_media ON product_images;
DROP FUNCTION IF EXISTS ensure_product_media_asset_is_active();
DROP INDEX IF EXISTS idx_media_assets_deletion_status;
ALTER TABLE media_assets DROP COLUMN IF EXISTS pending_delete_at, DROP COLUMN IF EXISTS deletion_status;
