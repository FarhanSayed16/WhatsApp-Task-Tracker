-- ═══════════════════════════════════════════════════════════════════════════════
-- WhatsApp Task Tracker — Complete Production Database Schema (v1.2)
-- Locked: 15 Oct 2026
-- Incorporates ALL 30 review fixes + single-org seed + RLS + auto updated_at
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ensure pgcrypto / uuid-ossp extension is enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper Function: update_modified_column()
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. ORGANIZATIONS (Multi-tenant foundation, single org seeded for MVP)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan text DEFAULT 'free' CHECK (plan IN ('free','pro','business','enterprise')),
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS trigger_organizations_updated_at ON organizations;
CREATE TRIGGER trigger_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. ADMIN (Admin / Professor accounts with PIN authentication)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  pin_hash text NOT NULL,
  role text DEFAULT 'owner' CHECK (role IN ('owner','co_admin')),
  timezone text DEFAULT 'Asia/Kolkata',
  session_version int DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS trigger_admin_updated_at ON admin;
CREATE TRIGGER trigger_admin_updated_at
  BEFORE UPDATE ON admin
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. RATE LIMITING (Brute force protection for PIN login)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS login_attempts (
  id bigserial PRIMARY KEY,
  ip text NOT NULL,
  org_id uuid REFERENCES organizations(id),
  success boolean NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created 
  ON login_attempts(ip, created_at);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. GROUPS (WhatsApp student / team groups)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  verify_required boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_by uuid REFERENCES admin(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_groups_org 
  ON groups(org_id) 
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trigger_groups_updated_at ON groups;
CREATE TRIGGER trigger_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. MEMBERS (Students / group members)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE RESTRICT,
  name text NOT NULL,
  phone text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_members_group 
  ON members(group_id) 
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trigger_members_updated_at ON members;
CREATE TRIGGER trigger_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. TEMPLATES (Reusable checklist & WhatsApp message templates)
-- ═════════════════════════════════════════════════════════════
-- Checklist body: { "items": ["Task 1", "Task 2"], "default_due_offset_hours": 24 }
-- Message body:   { "text": "...", "placeholders": ["{title}", "{link}"] }
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text CHECK (type IN ('checklist','message')),
  name text NOT NULL,
  body jsonb NOT NULL,
  created_by uuid REFERENCES admin(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS trigger_templates_updated_at ON templates;
CREATE TRIGGER trigger_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. TASK LISTS (Daily / assigned task checklists)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS task_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE RESTRICT,
  title text NOT NULL,
  list_date date NOT NULL,
  due_at timestamptz,
  token text UNIQUE NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft','active','completed','archived')),
  recurrence jsonb,
  shared_at timestamptz,
  created_by uuid REFERENCES admin(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_task_lists_org_date 
  ON task_lists(org_id, list_date);

CREATE INDEX IF NOT EXISTS idx_task_lists_group_date 
  ON task_lists(group_id, list_date);

CREATE INDEX IF NOT EXISTS idx_task_lists_token 
  ON task_lists(token);

DROP TRIGGER IF EXISTS trigger_task_lists_updated_at ON task_lists;
CREATE TRIGGER trigger_task_lists_updated_at
  BEFORE UPDATE ON task_lists
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. TASK ITEMS (Denormalized status for lightning-fast reads)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS task_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_list_id uuid REFERENCES task_lists(id) ON DELETE CASCADE,
  text text NOT NULL,
  position int NOT NULL,
  priority text DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_member_id uuid REFERENCES members(id),
  due_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending','done','verified')),
  completed_by uuid REFERENCES members(id),
  completed_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_items_list 
  ON task_items(task_list_id, position);

DROP TRIGGER IF EXISTS trigger_task_items_updated_at ON task_items;
CREATE TRIGGER trigger_task_items_updated_at
  BEFORE UPDATE ON task_items
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. COMPLETIONS (Audit log — tracks every tick/completion event)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_item_id uuid REFERENCES task_items(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id),
  status text CHECK (status IN ('done','verified')) DEFAULT 'done',
  note text,
  proof_path text,
  completed_at timestamptz DEFAULT now(),
  verified_at timestamptz,
  UNIQUE (task_item_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_completions_item 
  ON completions(task_item_id);

CREATE INDEX IF NOT EXISTS idx_completions_member 
  ON completions(member_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. SHARE LOG (Logs WhatsApp share and reminder dispatch events)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS share_log (
  id bigserial PRIMARY KEY,
  task_list_id uuid REFERENCES task_lists(id) ON DELETE CASCADE,
  kind text CHECK (kind IN ('share','reminder')),
  channel text CHECK (channel IN ('whatsapp_group','whatsapp_individual','copy','native_share')),
  member_id uuid REFERENCES members(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_log_task_list 
  ON share_log(task_list_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. OPENS (De-duplicated member tracking / read-receipt alternative)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS opens (
  id bigserial PRIMARY KEY,
  task_list_id uuid REFERENCES task_lists(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id),
  first_opened_at timestamptz DEFAULT now(),
  last_opened_at timestamptz DEFAULT now(),
  open_count int DEFAULT 1,
  UNIQUE (task_list_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_opens_task_list 
  ON opens(task_list_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. DAILY STATS (Pre-computed metrics for high-speed dashboard KPIs)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS daily_stats (
  id bigserial PRIMARY KEY,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id),
  stat_date date NOT NULL,
  tasks_created int DEFAULT 0,
  tasks_done int DEFAULT 0,
  tasks_verified int DEFAULT 0,
  tasks_overdue int DEFAULT 0,
  avg_response_minutes float,
  UNIQUE (org_id, group_id, stat_date)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) — Locked down; server-only access
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE organizations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin          ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_lists     ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE completions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE opens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats    ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED DATA (Default Organization & Admin PIN = 123456)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO organizations (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Workspace', 'default', 'free')
ON CONFLICT (id) DO NOTHING;

INSERT INTO admin (id, org_id, name, pin_hash, role, timezone, session_version)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Professor',
  '$2b$10$sMwryzSUR51c7Ib5hvb..eOoOkSg7TqAdr7Dgi6WBGiM4N2tp2fMm',
  'owner',
  'Asia/Kolkata',
  1
)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RPC: Atomic professor direct-complete (P0-5)
-- Also in: supabase/migrations/20261015120000_professor_complete_item.sql
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION professor_complete_item(p_item_id uuid, p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list_id uuid;
  v_item jsonb;
  v_now timestamptz := now();
BEGIN
  SELECT ti.task_list_id
  INTO v_list_id
  FROM task_items ti
  INNER JOIN task_lists tl ON tl.id = ti.task_list_id
  WHERE ti.id = p_item_id
    AND tl.org_id = p_org_id
    AND tl.deleted_at IS NULL;

  IF v_list_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE task_items
  SET
    status = 'verified',
    completed_by = NULL,
    completed_at = v_now,
    verified_at = v_now,
    updated_at = v_now
  WHERE id = p_item_id
  RETURNING to_jsonb(task_items.*) INTO v_item;

  DELETE FROM completions
  WHERE task_item_id = p_item_id
    AND member_id IS NULL;

  INSERT INTO completions (
    task_item_id, member_id, status, completed_at, verified_at, note
  )
  VALUES (
    p_item_id, NULL, 'verified', v_now, v_now,
    'Marked done directly by Professor'
  );

  IF NOT EXISTS (
    SELECT 1 FROM task_items
    WHERE task_list_id = v_list_id AND status = 'pending'
  ) THEN
    UPDATE task_lists
    SET status = 'completed', updated_at = v_now
    WHERE id = v_list_id AND status <> 'archived';
  END IF;

  RETURN v_item;
END;
$$;

REVOKE ALL ON FUNCTION professor_complete_item(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION professor_complete_item(uuid, uuid) TO service_role;
