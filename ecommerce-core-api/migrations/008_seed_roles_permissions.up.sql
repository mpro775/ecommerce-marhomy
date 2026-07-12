INSERT INTO permissions(code, description) VALUES
  ('dashboard:read','Read dashboard'),
  ('products:read','Read products'),('products:write','Manage products'),
  ('categories:read','Read categories'),('categories:write','Manage categories'),
  ('brands:read','Read brands'),('brands:write','Manage brands'),
  ('attributes:read','Read attributes'),('attributes:write','Manage attributes'),
  ('filters:read','Read filters'),('filters:write','Manage filters'),
  ('media:read','Read media'),('media:write','Manage media'),
  ('quote_requests:read','Read quote requests'),('quote_requests:write','Manage quote requests'),
  ('quote_requests:assign','Assign quote requests'),('quote_requests:export','Export quote requests'),
  ('contacts:read','Read contacts'),('contacts:write','Manage contacts'),
  ('notifications:read','Read notifications'),('notifications:write','Manage notifications'),
  ('analytics:read','Read analytics'),
  ('team:read','Read team'),('team:write','Manage team'),
  ('audit:read','Read audit log')
ON CONFLICT(code) DO NOTHING;
INSERT INTO roles(name, description) VALUES
  ('owner','Full access'),('manager','Operations manager'),('catalog_manager','Catalog manager'),
  ('quote_agent','Quote request agent'),('viewer','Read only')
ON CONFLICT(name) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'owner'
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON
  (r.name = 'manager' AND p.code NOT IN ('team:write'))
  OR (r.name = 'catalog_manager' AND split_part(p.code, ':', 1) IN ('dashboard','products','categories','brands','attributes','filters','media'))
  OR (r.name = 'quote_agent' AND split_part(p.code, ':', 1) IN ('dashboard','quote_requests','contacts','notifications'))
  OR (r.name = 'viewer' AND p.code LIKE '%:read')
ON CONFLICT DO NOTHING;
