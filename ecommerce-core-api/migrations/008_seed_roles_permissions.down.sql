DELETE FROM role_permissions;
DELETE FROM roles WHERE name IN ('owner','manager','catalog_manager','quote_agent','viewer');
DELETE FROM permissions;
