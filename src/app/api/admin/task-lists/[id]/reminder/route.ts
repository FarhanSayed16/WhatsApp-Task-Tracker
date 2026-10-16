import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import {
  nextReminderStateAfterSend,
  nextReminderStateAfterSnooze,
  parseReminderState,
  type ReminderKind,
} from "@/lib/reminders";

/**
 * PATCH /api/admin/task-lists/[id]/reminder
 * Body: { action: "mark_sent" | "snooze" | "assignment_sent", kind?: "due_soon" | "overdue", hours?: number }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const kind = (body.kind || "due_soon") as ReminderKind;
    const hours = typeof body.hours === "number" ? body.hours : 4;

    const { data: list, error } = await supabase
      .from("task_lists")
      .select("id, reminder")
      .eq("id", id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !list) {
      return apiError("Task list not found", "NOT_FOUND", 404);
    }

    const current = parseReminderState(list.reminder);
    let next = { ...current };

    if (action === "mark_sent") {
      next = nextReminderStateAfterSend(current, kind);
    } else if (action === "snooze") {
      next = nextReminderStateAfterSnooze(current, hours);
    } else if (action === "assignment_sent") {
      next = {
        ...current,
        assignment_prompted_at: new Date().toISOString(),
      };
    } else {
      return apiError("Invalid action", "VALIDATION_ERROR", 400);
    }

    const { error: updateErr } = await supabase
      .from("task_lists")
      .update({
        reminder: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("org_id", admin.orgId);

    if (updateErr) {
      // Column may not exist yet — soft-succeed so UI still works
      if (
        updateErr.message?.includes("reminder") ||
        updateErr.code === "PGRST204" ||
        updateErr.code === "42703"
      ) {
        return apiSuccess({
          reminder: next,
          persisted: false,
          note: "Run migration 20261016140000_task_list_reminders.sql to persist reminder state",
        });
      }
      throw updateErr;
    }

    return apiSuccess({ reminder: next, persisted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
