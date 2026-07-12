ALTER TABLE media_assets
  ADD COLUMN deletion_status VARCHAR(30) NOT NULL DEFAULT 'active'
    CHECK (deletion_status IN ('active','pending_delete')),
  ADD COLUMN pending_delete_at TIMESTAMPTZ;

CREATE INDEX idx_media_assets_deletion_status ON media_assets(deletion_status, created_at DESC);

CREATE FUNCTION ensure_product_media_asset_is_active() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.media_asset_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM media_assets
    WHERE id = NEW.media_asset_id AND deletion_status = 'active'
    FOR SHARE
  ) THEN
    RAISE EXCEPTION 'media asset % is not active', NEW.media_asset_id
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_images_active_media
  BEFORE INSERT OR UPDATE OF media_asset_id ON product_images
  FOR EACH ROW EXECUTE FUNCTION ensure_product_media_asset_is_active();
