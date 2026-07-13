ALTER TABLE outbox_events
  ADD COLUMN locked_at TIMESTAMPTZ,
  ADD COLUMN locked_by VARCHAR(100),
  ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 10;

ALTER TABLE outbox_events DROP CONSTRAINT outbox_events_status_check;
ALTER TABLE outbox_events ADD CONSTRAINT outbox_events_status_check
  CHECK(status IN ('pending', 'processing', 'sent', 'failed', 'dead'));

UPDATE outbox_events
SET
  status = 'failed',
  locked_at = NULL,
  locked_by = NULL
WHERE status = 'processing'
  AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '5 minutes');

INSERT INTO permissions(code, description) VALUES
  ('system:manage','Manage system and background tasks')
ON CONFLICT(code) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'owner' AND p.code = 'system:manage'
ON CONFLICT DO NOTHING;
