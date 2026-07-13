DROP TRIGGER IF EXISTS trg_validate_model_specification_value ON product_model_specification_values;
DROP FUNCTION IF EXISTS validate_model_specification_value();
DROP TABLE IF EXISTS product_model_specification_values, category_specifications, specification_options,
  specification_definitions, product_model_images, product_models CASCADE;
