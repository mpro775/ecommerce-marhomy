ALTER TABLE categories
  ADD CONSTRAINT categories_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id);

CREATE OR REPLACE FUNCTION prevent_category_cycle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id FROM categories WHERE id = NEW.parent_id
      UNION
      SELECT c.id, c.parent_id
      FROM categories c
      JOIN ancestors a ON c.id = a.parent_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'category hierarchy cycle detected' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER categories_prevent_cycle
BEFORE INSERT OR UPDATE OF parent_id ON categories
FOR EACH ROW EXECUTE FUNCTION prevent_category_cycle();
