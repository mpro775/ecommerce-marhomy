DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions);
DELETE FROM permissions;
DELETE FROM roles WHERE name IN ('owner','manager','catalog_manager','sales','viewer','content_editor');
