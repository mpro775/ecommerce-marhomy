CREATE TABLE catalog_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name VARCHAR(80) NOT NULL,
  anonymous_id VARCHAR(100),
  session_id VARCHAR(100),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  quote_cart_id UUID REFERENCES quote_carts(id) ON DELETE SET NULL,
  quote_request_id UUID REFERENCES quote_requests(id) ON DELETE SET NULL,
  source VARCHAR(50),
  city VARCHAR(150),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
