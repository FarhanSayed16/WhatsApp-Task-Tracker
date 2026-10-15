-- ═════════════════════════════════════════════════════════════
-- WhatsApp Task Tracker — Complete Production Schema
-- Incorporates all 30 review fixes + single-org seed
-- ═════════════════════════════════════════════════════════════

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan text DEFAULT 'free' CHECK (plan IN ('free','pro','business','enterprise')),
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Admin (single professor / co-admins)
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

-- 3. Rate Limiting (login brute-force defense)
CREATE TABLE IF NOT EXISTS login_attempts (
  id bigserial PRIMARY KEY,
  ip text NOT NULL,
  org_id uuid REFERENCES organizations(id),
  success boolean NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created ON login_attempts(ip, created_at);

-- 4. Groups
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
CREATE INDEX IF NOT EXISTS idx_groups_org ON groups(org_id);

-- 5. Members
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
CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_id);

-- 6. Templates
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

-- 7. Task Lists
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
CREATE INDEX IF NOT EXISTS idx_task_lists_org_date ON task_lists(org_id, list_date);
CREATE INDEX IF NOT EXISTS idx_task_lists_group_date ON task_lists(group_id, list_date);
CREATE INDEX IF NOT EXISTS idx_task_lists_token ON task_lists(token);

-- 8. Task Items (Denormalized status for high performance reads)
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
CREATE INDEX IF NOT EXISTS idx_task_items_list ON task_items(task_list_id, position);

-- 9. Completions (Audit log)
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
CREATE INDEX IF NOT EXISTS idx_completions_item ON completions(task_item_id);
CREATE INDEX IF NOT EXISTS idx_completions_member ON completions(member_id);

-- 10. Share Log
CREATE TABLE IF NOT EXISTS share_log (
  id bigserial PRIMARY KEY,
  task_list_id uuid REFERENCES task_lists(id) ON DELETE CASCADE,
  kind text CHECK (kind IN ('share','reminder')),
  channel text CHECK (channel IN ('whatsapp_group','whatsapp_individual','copy','native_share')),
  member_id uuid REFERENCES members(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_share_log_task_list ON share_log(task_list_id);

-- 11. Opens (De-duplicated member tracking)
CREATE TABLE IF NOT EXISTS opens (
  id bigserial PRIMARY KEY,
  task_list_id uuid REFERENCES task_lists(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id),
  first_opened_at timestamptz DEFAULT now(),
  last_opened_at timestamptz DEFAULT now(),
  open_count int DEFAULT 1,
  UNIQUE (task_list_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_opens_task_list ON opens(task_list_id);

-- 12. Daily Stats
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

-- ═════════════════════════════════════════════════════════════
-- Row Level Security (RLS) — Locked down; server-side only
-- ═════════════════════════════════════════════════════════════
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

-- ═════════════════════════════════════════════════════════════
-- Seed Initial Data (Default Org & Admin PIN = 123456)
-- ═════════════════════════════════════════════════════════════
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
