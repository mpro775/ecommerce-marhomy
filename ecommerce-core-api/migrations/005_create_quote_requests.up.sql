CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(200) NOT NULL,
  phone VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255),
  company_name VARCHAR(255),
  city VARCHAR(150),
  preferred_contact_method VARCHAR(30),
  first_request_at TIMESTAMPTZ,
  last_request_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quote_request_sequences (
  request_year INTEGER PRIMARY KEY,
  last_value INTEGER NOT NULL CHECK (last_value > 0)
);

CREATE TABLE quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(50) NOT NULL UNIQUE,
  public_token VARCHAR(100) NOT NULL UNIQUE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','in_review','contacted','quote_sent','accepted','rejected','cancelled','closed')),
  full_name VARCHAR(200) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  company_name VARCHAR(255),
  city VARCHAR(150),
  address_text TEXT,
  delivery_notes TEXT,
  preferred_contact_method VARCHAR(30),
  customer_note TEXT,
  source VARCHAR(30) NOT NULL DEFAULT 'web',
  assigned_to_admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  first_reviewed_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  requester_ip INET,
  requester_user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quote_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  model_id UUID REFERENCES product_models(id) ON DELETE SET NULL,
  product_title_snapshot VARCHAR(255) NOT NULL,
  product_slug_snapshot VARCHAR(255),
  model_code_snapshot VARCHAR(120) NOT NULL,
  model_title_snapshot VARCHAR(255),
  sku_snapshot VARCHAR(120),
  image_url_snapshot TEXT,
  model_description_snapshot TEXT,
  specifications_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  availability_snapshot VARCHAR(40),
  quantity_rules_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  category_id_snapshot UUID,
  category_title_snapshot VARCHAR(255),
  brand_id_snapshot UUID,
  brand_title_snapshot VARCHAR(255),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_snapshot VARCHAR(40) NOT NULL,
  item_note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quote_request_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  old_status VARCHAR(30), new_status VARCHAR(30) NOT NULL,
  changed_by_admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quote_request_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES admin_users(id),
  content TEXT NOT NULL, is_internal BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
