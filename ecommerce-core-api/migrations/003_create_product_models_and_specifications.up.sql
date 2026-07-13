CREATE TABLE product_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  model_code VARCHAR(120) NOT NULL,
  title_ar VARCHAR(255),
  title_en VARCHAR(255),
  short_description_ar TEXT,
  short_description_en TEXT,
  description_ar TEXT,
  description_en TEXT,
  sku VARCHAR(120),
  barcode VARCHAR(120),
  availability_status VARCHAR(40) NOT NULL DEFAULT 'available'
    CHECK (availability_status IN ('available','available_on_request','out_of_stock','discontinued','hidden')),
  quote_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  unit_of_measure VARCHAR(40) NOT NULL DEFAULT 'piece',
  minimum_request_quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  maximum_request_quantity NUMERIC(14,3),
  quantity_step NUMERIC(14,3) NOT NULL DEFAULT 1,
  datasheet_url TEXT,
  manual_url TEXT,
  video_url TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_models_code_unique UNIQUE (product_id, model_code),
  CONSTRAINT product_models_minimum_positive CHECK (minimum_request_quantity > 0),
  CONSTRAINT product_models_step_positive CHECK (quantity_step > 0),
  CONSTRAINT product_models_maximum_valid CHECK (
    maximum_request_quantity IS NULL OR maximum_request_quantity >= minimum_request_quantity
  )
);

CREATE TABLE product_model_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES product_models(id) ON DELETE CASCADE,
  media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  alt_text_ar VARCHAR(255),
  alt_text_en VARCHAR(255),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE specification_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(150) NOT NULL UNIQUE,
  name_ar VARCHAR(150) NOT NULL,
  name_en VARCHAR(150),
  value_type VARCHAR(30) NOT NULL CHECK (value_type IN ('text','number','range','option','boolean')),
  unit_ar VARCHAR(50),
  unit_en VARCHAR(50),
  is_required_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_filterable BOOLEAN NOT NULL DEFAULT FALSE,
  is_comparable BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE specification_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specification_id UUID NOT NULL REFERENCES specification_definitions(id) ON DELETE CASCADE,
  value_key VARCHAR(120) NOT NULL,
  label_ar VARCHAR(150) NOT NULL,
  label_en VARCHAR(150),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (specification_id, value_key)
);

CREATE TABLE category_specifications (
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  specification_id UUID NOT NULL REFERENCES specification_definitions(id) ON DELETE RESTRICT,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_filterable_override BOOLEAN,
  is_comparable_override BOOLEAN,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (category_id, specification_id)
);

CREATE TABLE product_model_specification_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES product_models(id) ON DELETE CASCADE,
  specification_id UUID NOT NULL REFERENCES specification_definitions(id) ON DELETE RESTRICT,
  value_text_ar TEXT,
  value_text_en TEXT,
  value_number NUMERIC(18,4),
  value_number_to NUMERIC(18,4),
  value_boolean BOOLEAN,
  option_id UUID REFERENCES specification_options(id) ON DELETE RESTRICT,
  display_value_ar TEXT,
  display_value_en TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (model_id, specification_id),
  CHECK (value_number_to IS NULL OR value_number IS NOT NULL),
  CHECK (value_number_to IS NULL OR value_number_to >= value_number)
);

CREATE UNIQUE INDEX product_models_default_unique ON product_models(product_id)
  WHERE is_default = TRUE AND is_active = TRUE;
CREATE UNIQUE INDEX product_models_sku_unique ON product_models(LOWER(sku)) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX product_models_barcode_unique ON product_models(barcode) WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX product_model_primary_image_unique ON product_model_images(model_id) WHERE is_primary;

CREATE FUNCTION validate_model_specification_value() RETURNS TRIGGER AS $$
DECLARE definition_type VARCHAR(30); option_specification UUID;
BEGIN
  SELECT value_type INTO definition_type FROM specification_definitions WHERE id = NEW.specification_id;
  IF definition_type = 'text' AND NEW.value_text_ar IS NULL AND NEW.value_text_en IS NULL THEN
    RAISE EXCEPTION 'text specification requires a text value' USING ERRCODE = '23514';
  ELSIF definition_type = 'number' AND NEW.value_number IS NULL THEN
    RAISE EXCEPTION 'number specification requires value_number' USING ERRCODE = '23514';
  ELSIF definition_type = 'range' AND (NEW.value_number IS NULL OR NEW.value_number_to IS NULL) THEN
    RAISE EXCEPTION 'range specification requires both numeric bounds' USING ERRCODE = '23514';
  ELSIF definition_type = 'boolean' AND NEW.value_boolean IS NULL THEN
    RAISE EXCEPTION 'boolean specification requires value_boolean' USING ERRCODE = '23514';
  ELSIF definition_type = 'option' THEN
    SELECT specification_id INTO option_specification FROM specification_options WHERE id = NEW.option_id;
    IF option_specification IS DISTINCT FROM NEW.specification_id THEN
      RAISE EXCEPTION 'option does not belong to specification' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_validate_model_specification_value
  BEFORE INSERT OR UPDATE ON product_model_specification_values
  FOR EACH ROW EXECUTE FUNCTION validate_model_specification_value();
