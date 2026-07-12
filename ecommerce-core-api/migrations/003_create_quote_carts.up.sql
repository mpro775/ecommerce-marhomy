CREATE TABLE quote_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token VARCHAR(100) NOT NULL UNIQUE,
  visitor_id VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK(status IN ('open','submitted','expired')),
  expires_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE quote_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_cart_id UUID NOT NULL REFERENCES quote_carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity NUMERIC(14,3) NOT NULL CHECK(quantity > 0),
  unit_snapshot VARCHAR(50) NOT NULL,
  selected_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  item_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX quote_cart_items_unique_selection
  ON quote_cart_items(quote_cart_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), md5(selected_options::text));
