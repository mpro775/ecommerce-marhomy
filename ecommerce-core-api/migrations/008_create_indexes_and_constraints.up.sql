CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX admin_sessions_user_idx ON admin_sessions(admin_user_id, revoked_at);
CREATE INDEX audit_logs_created_idx ON audit_logs(created_at DESC);
CREATE INDEX categories_parent_sort_idx ON categories(parent_id, is_active, sort_order);
CREATE INDEX products_public_idx ON products(status, quote_enabled, sort_order, created_at DESC);
CREATE INDEX products_category_idx ON products(primary_category_id);
CREATE INDEX products_brand_idx ON products(brand_id);
CREATE INDEX products_tags_gin_idx ON products USING GIN(tags);
CREATE INDEX products_title_ar_trgm_idx ON products USING GIN(title_ar gin_trgm_ops);
CREATE INDEX products_title_en_trgm_idx ON products USING GIN(title_en gin_trgm_ops);
CREATE UNIQUE INDEX product_primary_image_unique ON product_images(product_id) WHERE is_primary;
CREATE INDEX product_models_product_idx ON product_models(product_id, is_active, sort_order);
CREATE INDEX product_models_code_search_idx ON product_models(LOWER(model_code));
CREATE INDEX product_models_code_trgm_idx ON product_models USING GIN(model_code gin_trgm_ops);
CREATE INDEX product_model_spec_number_idx ON product_model_specification_values(specification_id, value_number, value_number_to);
CREATE INDEX product_model_spec_option_idx ON product_model_specification_values(specification_id, option_id);
CREATE INDEX product_model_spec_text_trgm_idx ON product_model_specification_values USING GIN(display_value_en gin_trgm_ops);
CREATE INDEX quote_carts_expiry_idx ON quote_carts(status, expires_at);
CREATE INDEX quote_carts_maintenance_idx ON quote_carts(status, archived_at, expires_at);
CREATE INDEX quote_carts_visitor_created_idx ON quote_carts(visitor_id, created_at DESC) WHERE visitor_id IS NOT NULL;
CREATE INDEX quote_requests_status_created_idx ON quote_requests(status, created_at DESC);
CREATE INDEX quote_requests_contact_idx ON quote_requests(contact_id, created_at DESC);
CREATE INDEX quote_requests_assignee_idx ON quote_requests(assigned_to_admin_user_id, status);
CREATE INDEX quote_requests_search_idx ON quote_requests(request_number, phone);
CREATE INDEX quote_request_items_product_idx ON quote_request_items(product_id);
CREATE INDEX quote_request_items_model_idx ON quote_request_items(model_id);
CREATE INDEX quote_request_items_category_snapshot_idx ON quote_request_items(category_id_snapshot);
CREATE INDEX quote_request_items_brand_snapshot_idx ON quote_request_items(brand_id_snapshot);
CREATE INDEX notification_recipients_user_unread_idx ON notification_recipients(admin_user_id, read_at, notification_id);
CREATE INDEX notifications_created_at_idx ON notifications(created_at DESC);
CREATE INDEX outbox_pending_idx ON outbox_events(status, available_at) WHERE status IN ('pending','failed');
CREATE INDEX idempotency_keys_expiry_idx ON idempotency_keys(expires_at);
CREATE INDEX catalog_events_name_created_idx ON catalog_events(event_name, created_at DESC);
CREATE INDEX catalog_events_product_idx ON catalog_events(product_id, created_at DESC);
CREATE INDEX catalog_events_model_idx ON catalog_events(model_id, created_at DESC);

CREATE FUNCTION prevent_category_cycle() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id FROM categories WHERE id = NEW.parent_id
      UNION ALL
      SELECT c.id, c.parent_id FROM categories c JOIN ancestors a ON c.id = a.parent_id
    ) SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN RAISE EXCEPTION 'category hierarchy cycle detected' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER categories_prevent_cycle BEFORE INSERT OR UPDATE OF parent_id ON categories
  FOR EACH ROW EXECUTE FUNCTION prevent_category_cycle();

CREATE FUNCTION ensure_media_asset_is_active() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.media_asset_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM media_assets WHERE id = NEW.media_asset_id AND deletion_status = 'active' FOR SHARE
  ) THEN RAISE EXCEPTION 'media asset % is not active', NEW.media_asset_id USING ERRCODE = '23503'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER product_images_active_media BEFORE INSERT OR UPDATE OF media_asset_id ON product_images
  FOR EACH ROW EXECUTE FUNCTION ensure_media_asset_is_active();
CREATE TRIGGER product_model_images_active_media BEFORE INSERT OR UPDATE OF media_asset_id ON product_model_images
  FOR EACH ROW EXECUTE FUNCTION ensure_media_asset_is_active();

CREATE FUNCTION choose_first_product_model() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active AND NOT EXISTS (
    SELECT 1 FROM product_models WHERE product_id = NEW.product_id AND is_active AND is_default
  ) THEN NEW.is_default := TRUE; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER product_models_choose_first BEFORE INSERT ON product_models
  FOR EACH ROW EXECUTE FUNCTION choose_first_product_model();

CREATE FUNCTION repair_default_product_model() RETURNS TRIGGER AS $$
DECLARE owner_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN owner_id := OLD.product_id; ELSE owner_id := NEW.product_id; END IF;
  IF NOT EXISTS (SELECT 1 FROM product_models WHERE product_id = owner_id AND is_active AND is_default) THEN
    UPDATE product_models SET is_default = TRUE, updated_at = NOW()
    WHERE id = (SELECT id FROM product_models WHERE product_id = owner_id AND is_active ORDER BY sort_order, created_at LIMIT 1);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER product_models_repair_default AFTER UPDATE OF is_active OR DELETE ON product_models
  FOR EACH ROW EXECUTE FUNCTION repair_default_product_model();

CREATE FUNCTION protect_published_product_models() RETURNS TRIGGER AS $$
DECLARE product_is_published BOOLEAN; product_allows_quote BOOLEAN; removes_active BOOLEAN; removes_requestable BOOLEAN;
BEGIN
  SELECT status = 'published', quote_enabled INTO product_is_published, product_allows_quote FROM products WHERE id = OLD.product_id;
  IF NOT product_is_published THEN IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
  removes_active := OLD.is_active AND (TG_OP = 'DELETE' OR NOT NEW.is_active);
  removes_requestable := OLD.is_active AND OLD.quote_enabled AND OLD.availability_status NOT IN ('hidden','discontinued')
    AND (TG_OP = 'DELETE' OR NOT NEW.is_active OR NOT NEW.quote_enabled OR NEW.availability_status IN ('hidden','discontinued'));
  IF removes_active AND NOT EXISTS (SELECT 1 FROM product_models WHERE product_id=OLD.product_id AND id<>OLD.id AND is_active) THEN
    RAISE EXCEPTION 'published product requires an active model' USING ERRCODE = '23514';
  END IF;
  IF product_allows_quote AND removes_requestable AND NOT EXISTS (
    SELECT 1 FROM product_models WHERE product_id=OLD.product_id AND id<>OLD.id AND is_active AND quote_enabled
      AND availability_status NOT IN ('hidden','discontinued')
  ) THEN RAISE EXCEPTION 'quote-enabled product requires a requestable model' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER product_models_protect_published BEFORE UPDATE OF is_active,quote_enabled,availability_status OR DELETE ON product_models
  FOR EACH ROW EXECUTE FUNCTION protect_published_product_models();

CREATE FUNCTION validate_product_publication() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND NOT EXISTS (
    SELECT 1 FROM product_models WHERE product_id = NEW.id AND is_active
  ) THEN RAISE EXCEPTION 'published product requires an active model' USING ERRCODE = '23514'; END IF;
  IF NEW.status = 'published' AND NEW.quote_enabled AND NOT EXISTS (
    SELECT 1 FROM product_models WHERE product_id = NEW.id AND is_active AND quote_enabled
      AND availability_status NOT IN ('hidden','discontinued')
  ) THEN RAISE EXCEPTION 'quote-enabled product requires a requestable model' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER products_validate_publication BEFORE INSERT OR UPDATE OF status, quote_enabled ON products
  FOR EACH ROW EXECUTE FUNCTION validate_product_publication();
