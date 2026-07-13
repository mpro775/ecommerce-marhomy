ALTER TABLE outbox_events DROP CONSTRAINT outbox_events_status_check;
ALTER TABLE outbox_events ADD CONSTRAINT outbox_events_status_check
  CHECK(status IN ('pending', 'processing', 'sent', 'failed'));

ALTER TABLE outbox_events
  DROP COLUMN locked_at,
  DROP COLUMN locked_by,
  DROP COLUMN max_attempts;

DELETE FROM permissions WHERE code = 'system:manage';
