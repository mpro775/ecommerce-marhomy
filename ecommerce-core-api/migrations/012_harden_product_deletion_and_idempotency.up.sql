ALTER TABLE quote_cart_items
  DROP CONSTRAINT quote_cart_items_product_id_fkey;

ALTER TABLE quote_cart_items
  ADD CONSTRAINT quote_cart_items_product_id_fkey
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT;

CREATE INDEX idempotency_keys_expiry_idx ON idempotency_keys(expires_at);
