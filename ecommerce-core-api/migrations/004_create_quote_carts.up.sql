CREATE TABLE quote_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token VARCHAR(100) NOT NULL UNIQUE,
  visitor_id VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open','submitted','expired')),
  is_suspicious BOOLEAN NOT NULL DEFAULT FALSE,
  suspicion_reason VARCHAR(100),
  expires_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quote_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_cart_id UUID NOT NULL REFERENCES quote_carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  model_id UUID NOT NULL REFERENCES product_models(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_snapshot VARCHAR(40) NOT NULL,
  item_note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quote_cart_id, model_id)
);
