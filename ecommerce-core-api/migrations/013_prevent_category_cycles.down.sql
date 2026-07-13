DROP TRIGGER IF EXISTS categories_prevent_cycle ON categories;
DROP FUNCTION IF EXISTS prevent_category_cycle();
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_parent_not_self;
