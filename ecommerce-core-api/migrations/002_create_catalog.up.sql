CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  title_ar VARCHAR(255) NOT NULL,
  title_en VARCHAR(255),
  slug VARCHAR(255) NOT NULL UNIQUE,
  description_ar TEXT,
  description_en TEXT,
  image_url TEXT,
  seo_title_ar VARCHAR(255),
  seo_title_en VARCHAR(255),
  seo_description_ar TEXT,
  seo_description_en TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar VARCHAR(255) NOT NULL,
  title_en VARCHAR(255),
  slug VARCHAR(255) NOT NULL UNIQUE,
  description_ar TEXT,
  description_en TEXT,
  logo_url TEXT,
  seo_title_ar VARCHAR(255),
  seo_title_en VARCHAR(255),
  seo_description_ar TEXT,
  seo_description_en TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  alt_text_ar VARCHAR(255),
  alt_text_en VARCHAR(255),
  created_by_admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  title_ar VARCHAR(255) NOT NULL,
  title_en VARCHAR(255),
  slug VARCHAR(255) NOT NULL UNIQUE,
  short_description_ar TEXT,
  short_description_en TEXT,
  detailed_description_ar TEXT,
  detailed_description_en TEXT,
  model_code VARCHAR(100),
  sku VARCHAR(100) UNIQUE,
  barcode VARCHAR(100) UNIQUE,
  youtube_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  seo_title_ar VARCHAR(255),
  seo_title_en VARCHAR(255),
  seo_description_ar TEXT,
  seo_description_en TEXT,
  quote_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  availability_status VARCHAR(40) NOT NULL DEFAULT 'available'
    CHECK (availability_status IN ('available','on_request','temporarily_unavailable','discontinued')),
  unit_of_measure VARCHAR(30) NOT NULL DEFAULT 'piece'
    CHECK (unit_of_measure IN ('piece','box','carton','meter','kilogram','gram','liter','set','roll','pack')),
  minimum_request_quantity NUMERIC(14,3) NOT NULL DEFAULT 1 CHECK (minimum_request_quantity > 0),
  maximum_request_quantity NUMERIC(14,3),
  quantity_step NUMERIC(14,3) NOT NULL DEFAULT 1 CHECK (quantity_step > 0),
  specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (maximum_request_quantity IS NULL OR maximum_request_quantity >= minimum_request_quantity)
);
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  alt_text_ar VARCHAR(255),
  alt_text_en VARCHAR(255),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title_ar VARCHAR(255) NOT NULL,
  title_en VARCHAR(255),
  sku VARCHAR(100) UNIQUE,
  barcode VARCHAR(100) UNIQUE,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar VARCHAR(150) NOT NULL,
  name_en VARCHAR(150),
  slug VARCHAR(150) NOT NULL UNIQUE,
  input_type VARCHAR(30) NOT NULL DEFAULT 'select',
  is_filterable BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  value_ar VARCHAR(150) NOT NULL,
  value_en VARCHAR(150),
  code VARCHAR(100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(attribute_id, value_ar)
);
CREATE TABLE category_attributes (
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(category_id, attribute_id)
);
CREATE TABLE variant_attribute_values (
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  attribute_value_id UUID NOT NULL REFERENCES attribute_values(id) ON DELETE CASCADE,
  PRIMARY KEY(variant_id, attribute_value_id)
);
CREATE TABLE product_categories (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY(product_id, category_id)
);
CREATE TABLE product_related_products (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  related_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(product_id, related_product_id),
  CHECK(product_id <> related_product_id)
);
CREATE TABLE filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar VARCHAR(150) NOT NULL,
  name_en VARCHAR(150),
  slug VARCHAR(150) NOT NULL UNIQUE,
  filter_type VARCHAR(30) NOT NULL DEFAULT 'option' CHECK(filter_type IN ('option','range')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE filter_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filter_id UUID NOT NULL REFERENCES filters(id) ON DELETE CASCADE,
  value_ar VARCHAR(150) NOT NULL,
  value_en VARCHAR(150),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(filter_id, value_ar)
);
CREATE TABLE product_filter_values (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  filter_value_id UUID NOT NULL REFERENCES filter_values(id) ON DELETE CASCADE,
  PRIMARY KEY(product_id, filter_value_id)
);
CREATE TABLE product_filter_ranges (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  filter_id UUID NOT NULL REFERENCES filters(id) ON DELETE CASCADE,
  range_value NUMERIC(14,3) NOT NULL,
  PRIMARY KEY(product_id, filter_id)
);
