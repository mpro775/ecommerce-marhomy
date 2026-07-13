INSERT INTO permissions(code, description) VALUES
  ('dashboard:read','Read dashboard'),
  ('products:read','Read products'),('products:write','Manage products'),
  ('product-models:read','Read product models'),('product-models:write','Manage product models'),
  ('categories:read','Read categories'),('categories:write','Manage categories'),
  ('brands:read','Read brands'),('brands:write','Manage brands'),
  ('specifications:read','Read specifications'),('specifications:write','Manage specifications'),
  ('media:read','Read media'),('media:write','Manage media'),
  ('catalog-imports:read','Read catalog imports'),('catalog-imports:write','Run catalog imports'),
  ('quote-requests:read','Read quote requests'),('quote-requests:write','Manage quote requests'),
  ('quote-requests:assign','Assign quote requests'),('quote-requests:export','Export quote requests'),
  ('contacts:read','Read contacts'),('contacts:write','Manage contacts'),
  ('notifications:read','Read notifications'),('notifications:write','Manage notifications'),
  ('analytics:read','Read analytics'),('team:read','Read team'),('team:write','Manage team'),
  ('audit:read','Read audit log'),('system:manage','Manage system and background tasks')
ON CONFLICT(code) DO NOTHING;

INSERT INTO roles(name, description) VALUES
  ('owner','Full access'),('manager','Operations manager'),('catalog_manager','Catalog manager'),
  ('sales','Sales and quote requests'),('viewer','Read only'),('content_editor','Catalog content editor')
ON CONFLICT(name) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.name='owner' ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON
  (r.name='manager' AND p.code NOT IN ('team:write','system:manage')) OR
  (r.name='catalog_manager' AND split_part(p.code,':',1) IN ('dashboard','products','product-models','categories','brands','specifications','media','catalog-imports')) OR
  (r.name='sales' AND split_part(p.code,':',1) IN ('dashboard','quote-requests','contacts','notifications')) OR
  (r.name='viewer' AND p.code LIKE '%:read') OR
  (r.name='content_editor' AND split_part(p.code,':',1) IN ('dashboard','products','product-models','categories','brands','specifications','media'))
ON CONFLICT DO NOTHING;
