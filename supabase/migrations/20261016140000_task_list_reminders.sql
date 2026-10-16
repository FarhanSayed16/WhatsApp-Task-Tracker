-- Reminder automation state on task lists (free one-tap WhatsApp flow)
-- Stores when due-soon/overdue was flagged, sent, or snoozed.

ALTER TABLE task_lists
  ADD COLUMN IF NOT EXISTS reminder jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN task_lists.reminder IS
  'Reminder automation: due_soon_ready_at, overdue_ready_at, *_sent_at, snooze_until, assignment_prompted_at';

CREATE INDEX IF NOT EXISTS idx_task_lists_active_due
  ON task_lists (org_id, due_at)
  WHERE deleted_at IS NULL AND status = 'active' AND due_at IS NOT NULL;
