/**
 * Free one-tap reminder automation helpers.
 * System tracks due timing; professor sends via WhatsApp with one tap.
 */

export type ReminderKind = "due_soon" | "overdue";

export interface TaskListReminderState {
  due_soon_ready_at?: string | null;
  overdue_ready_at?: string | null;
  due_soon_sent_at?: string | null;
  overdue_sent_at?: string | null;
  snooze_until?: string | null;
  assignment_prompted_at?: string | null;
}

export interface OrgReminderSettings {
  enabled: boolean;
  /** Hours before due_at to surface a due-soon reminder (default 24) */
  due_soon_hours: number;
}

export const DEFAULT_REMINDER_SETTINGS: OrgReminderSettings = {
  enabled: true,
  due_soon_hours: 24,
};

export function parseReminderSettings(
  orgSettings: Record<string, unknown> | null | undefined
): OrgReminderSettings {
  const raw = (orgSettings?.reminders || {}) as Partial<OrgReminderSettings>;
  return {
    enabled: raw.enabled !== false,
    due_soon_hours:
      typeof raw.due_soon_hours === "number" && raw.due_soon_hours > 0
        ? Math.min(168, Math.max(1, raw.due_soon_hours))
        : DEFAULT_REMINDER_SETTINGS.due_soon_hours,
  };
}

export function parseReminderState(
  raw: unknown
): TaskListReminderState {
  if (!raw || typeof raw !== "object") return {};
  return raw as TaskListReminderState;
}

export interface ReminderScanList {
  id: string;
  title: string;
  token: string;
  due_at: string | null;
  status: string;
  reminder?: unknown;
  group_id?: string;
  group_name?: string;
  pending_count?: number;
  total_items?: number;
}

export interface ReminderReadyItem {
  id: string;
  token: string;
  title: string;
  group_id: string;
  group_name: string;
  due_at: string;
  kind: ReminderKind;
  pending_count: number;
  total_items: number;
  label: string;
}

function isSnoozed(state: TaskListReminderState, now: Date): boolean {
  if (!state.snooze_until) return false;
  return new Date(state.snooze_until).getTime() > now.getTime();
}

/**
 * Decide if a list should appear in "Reminders ready" right now.
 * Uses due_at + pending items; respects sent_at and snooze.
 */
export function evaluateListReminder(
  list: ReminderScanList,
  settings: OrgReminderSettings,
  now = new Date()
): ReminderReadyItem | null {
  if (!settings.enabled) return null;
  if (list.status !== "active") return null;
  if (!list.due_at) return null;

  const pending = list.pending_count ?? 0;
  if (pending <= 0) return null;

  const dueMs = new Date(list.due_at).getTime();
  if (Number.isNaN(dueMs)) return null;

  const state = parseReminderState(list.reminder);
  if (isSnoozed(state, now)) return null;

  const nowMs = now.getTime();
  const dueSoonMs = settings.due_soon_hours * 60 * 60 * 1000;

  const groupName = list.group_name || "Group";
  const groupId = list.group_id || "";

  // Overdue takes priority
  if (dueMs < nowMs) {
    if (state.overdue_sent_at) return null;
    return {
      id: list.id,
      token: list.token,
      title: list.title,
      group_id: groupId,
      group_name: groupName,
      due_at: list.due_at,
      kind: "overdue",
      pending_count: pending,
      total_items: list.total_items || pending,
      label: "Overdue — send nudge",
    };
  }

  // Due soon window
  if (dueMs - nowMs <= dueSoonMs) {
    if (state.due_soon_sent_at) return null;
    return {
      id: list.id,
      token: list.token,
      title: list.title,
      group_id: groupId,
      group_name: groupName,
      due_at: list.due_at,
      kind: "due_soon",
      pending_count: pending,
      total_items: list.total_items || pending,
      label: `Due within ${settings.due_soon_hours}h — remind group`,
    };
  }

  return null;
}

/** Patch reminder jsonb after professor sends / snoozes */
export function nextReminderStateAfterSend(
  current: TaskListReminderState,
  kind: ReminderKind
): TaskListReminderState {
  const now = new Date().toISOString();
  if (kind === "overdue") {
    return { ...current, overdue_sent_at: now, overdue_ready_at: current.overdue_ready_at || now };
  }
  return { ...current, due_soon_sent_at: now, due_soon_ready_at: current.due_soon_ready_at || now };
}

export function nextReminderStateAfterSnooze(
  current: TaskListReminderState,
  hours = 4
): TaskListReminderState {
  const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  return { ...current, snooze_until: until };
}

export function nextReminderStateAfterCronFlag(
  current: TaskListReminderState,
  kind: ReminderKind
): TaskListReminderState {
  const now = new Date().toISOString();
  if (kind === "overdue") {
    return { ...current, overdue_ready_at: current.overdue_ready_at || now };
  }
  return { ...current, due_soon_ready_at: current.due_soon_ready_at || now };
}
