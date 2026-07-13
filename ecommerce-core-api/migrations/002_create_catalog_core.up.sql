CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  external_key VARCHAR(120) UNIQUE,
  catalog_code VARCHAR(50),
  title_ar VARCHAR(255) NOT NULL,
  title_en VARCHAR(255),
  slug VARCHAR(255) NOT NULL UNIQUE,
  description_ar TEXT,
  description_en TEXT,
  image_url TEXT,
  icon_key VARCHAR(100),
  seo_title_ar VARCHAR(255),
  seo_title_en VARCHAR(255),
  seo_description_ar TEXT,
  seo_description_en TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT categories_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key VARCHAR(120) UNIQUE,
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
  deletion_status VARCHAR(30) NOT NULL DEFAULT 'active'
    CHECK (deletion_status IN ('active','pending_delete')),
  pending_delete_at TIMESTAMPTZ,
  created_by_admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key VARCHAR(120) UNIQUE,
  primary_category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  title_ar VARCHAR(255) NOT NULL,
  title_en VARCHAR(255),
  slug VARCHAR(255) NOT NULL UNIQUE,
  short_description_ar TEXT,
  short_description_en TEXT,
  description_ar TEXT,
  description_en TEXT,
  video_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','archived')),
  published_at TIMESTAMPTZ,
  quote_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  seo_title_ar VARCHAR(255),
  seo_title_en VARCHAR(255),
  seo_description_ar TEXT,
  seo_description_en TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_categories (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  PRIMARY KEY (product_id, category_id)
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

CREATE TABLE product_related_products (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  related_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, related_product_id),
  CHECK (product_id <> related_product_id)
);
