// ═════════════════════════════════════════════════════════════
// WhatsApp Task Tracker — TypeScript Definitions
// ═════════════════════════════════════════════════════════════

export type OrgPlan = "free" | "pro" | "business" | "enterprise";
export type AdminRole = "owner" | "co_admin";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskItemStatus = "pending" | "done" | "verified";
export type TaskListStatus = "draft" | "active" | "completed" | "archived";
export type PublicLinkStatus = "active" | "readonly" | "expired";
export type ShareKind = "share" | "reminder";
export type ShareChannel = "whatsapp_group" | "whatsapp_individual" | "copy" | "native_share";
export type TemplateType = "checklist" | "message";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Admin {
  id: string;
  org_id: string;
  name: string;
  email?: string | null;
  pin_hash: string;
  role: AdminRole;
  timezone: string;
  session_version: number;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  org_id: string;
  name: string;
  description?: string | null;
  verify_required: boolean;
  sort_order: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  // Joined relation fields
  member_count?: number;
  members?: Member[];
}

export interface Member {
  id: string;
  group_id: string;
  name: string;
  phone?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface TaskList {
  id: string;
  org_id: string;
  group_id: string;
  title: string;
  list_date: string;
  due_at?: string | null;
  token: string;
  status: TaskListStatus;
  recurrence?: Record<string, unknown> | null;
  shared_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  // Joined fields
  group?: Group;
  items?: TaskItem[];
  item_count?: number;
  completed_count?: number;
}

export interface TaskItem {
  id: string;
  task_list_id: string;
  text: string;
  position: number;
  priority: TaskPriority;
  assigned_member_id?: string | null;
  due_at?: string | null;
  status: TaskItemStatus;
  completed_by?: string | null;
  completed_at?: string | null;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
  // Computed / joined helpers
  is_overdue?: boolean;
  completed_by_name?: string;
}

export interface Completion {
  id: string;
  task_item_id: string;
  member_id?: string | null;
  status: "done" | "verified";
  note?: string | null;
  proof_path?: string | null;
  completed_at: string;
  verified_at?: string | null;
}

export interface ShareLog {
  id: number;
  task_list_id: string;
  kind: ShareKind;
  channel: ShareChannel;
  member_id?: string | null;
  created_at: string;
}

export interface Open {
  id: number;
  task_list_id: string;
  member_id: string;
  first_opened_at: string;
  last_opened_at: string;
  open_count: number;
}

export interface DailyStat {
  id: number;
  org_id: string;
  group_id?: string | null;
  stat_date: string;
  tasks_created: number;
  tasks_done: number;
  tasks_verified: number;
  tasks_overdue: number;
  avg_response_minutes?: number | null;
}

export interface Template {
  id: string;
  org_id: string;
  type: TemplateType;
  name: string;
  body: {
    items?: string[];
    default_due_offset_hours?: number;
    text?: string;
    placeholders?: string[];
  };
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

// ═════════════════════════════════════════════════════════════
// Auth & Session
// ═════════════════════════════════════════════════════════════

export interface SessionPayload {
  sub: string;             // admin id
  orgId: string;           // organization id
  role: AdminRole;         // owner or co_admin
  sessionVersion: number;  // bumped on PIN change to revoke tokens
  name: string;
  timezone: string;
}

// ═════════════════════════════════════════════════════════════
// API Responses
// ═════════════════════════════════════════════════════════════

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: unknown;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

export interface PaginatedResponse<T = unknown> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ═════════════════════════════════════════════════════════════
// Dashboard Data DTO
// ═════════════════════════════════════════════════════════════

export interface DashboardKPIs {
  totalCreated: number;
  totalDone: number;
  totalVerified: number;
  totalPending: number;
  totalOverdue: number;
  completionRate: number;
}

export interface GroupSummaryCard {
  id: string;
  name: string;
  memberCount: number;
  activeListsCount: number;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  todayLists: TaskList[];
  groups: GroupSummaryCard[];
}

// ═════════════════════════════════════════════════════════════
// Public Member Page DTO
// ═════════════════════════════════════════════════════════════

export interface MemberPageData {
  status: PublicLinkStatus;
  expires_at?: string | null;
  task_list: {
    id: string;
    title: string;
    list_date: string;
    due_at?: string | null;
    verify_required: boolean;
    group_name: string;
  };
  items: TaskItem[];
  members: Array<{
    id: string;
    name: string;
  }>;
  completions: Completion[];
}

// ═════════════════════════════════════════════════════════════
// Input / Form Types
// ═════════════════════════════════════════════════════════════

export interface CreateGroupInput {
  name: string;
  description?: string | null;
  verify_required?: boolean;
  sort_order?: number;
  members?: Array<{ name: string; phone?: string | null }>;
}

export interface UpdateGroupInput {
  name?: string;
  description?: string | null;
  verify_required?: boolean;
  sort_order?: number;
}

export interface CreateMemberInput {
  group_id: string;
  name: string;
  phone?: string | null;
}

export interface UpdateMemberInput {
  name?: string;
  phone?: string | null;
  active?: boolean;
}

export interface CreateTaskListInput {
  group_id: string;
  title: string;
  list_date: string;
  due_at?: string | null;
  items: string[];
}

export interface UpdateTaskListInput {
  title?: string;
  list_date?: string;
  due_at?: string | null;
  status?: TaskListStatus;
}

export interface CreateTaskItemInput {
  task_list_id: string;
  text: string;
  position: number;
  priority?: TaskPriority;
  assigned_member_id?: string | null;
  due_at?: string | null;
}

export interface UpdateTaskItemInput {
  text?: string;
  position?: number;
  priority?: TaskPriority;
  assigned_member_id?: string | null;
  due_at?: string | null;
  status?: TaskItemStatus;
}

export interface CreateTemplateInput {
  type: TemplateType;
  name: string;
  body: {
    items?: string[];
    default_due_offset_hours?: number;
    text?: string;
    placeholders?: string[];
  };
}

export interface ChangePinInput {
  old_pin: string;
  new_pin: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface DateRangeFilter {
  from?: string;
  to?: string;
  group_id?: string;
  status?: TaskListStatus;
}
