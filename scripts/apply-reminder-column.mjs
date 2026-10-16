/**
 * Apply reminder jsonb column if missing.
 * Usage: node --env-file=.env.local scripts/apply-reminder-column.mjs
 * (or load env then node scripts/apply-reminder-column.mjs)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const { error } = await sb.from("task_lists").select("id, reminder").limit(1);

if (!error) {
  console.log("OK — task_lists.reminder already exists");
  process.exit(0);
}

console.log("Column missing or query failed:", error.message);
console.log("");
console.log("Run this in Supabase SQL Editor:");
console.log(`
ALTER TABLE task_lists
  ADD COLUMN IF NOT EXISTS reminder jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_task_lists_active_due
  ON task_lists (org_id, due_at)
  WHERE deleted_at IS NULL AND status = 'active' AND due_at IS NOT NULL;
`);
process.exit(2);
