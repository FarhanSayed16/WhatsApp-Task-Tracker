import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { apiError, apiSuccess } from "@/lib/errors";
import { draftContextualReminder } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const body = await req.json().catch(() => ({}));
    const { task_list_id, language = "en", tone = "polite" } = body;

    if (!task_list_id) {
      return apiError("task_list_id is required", "MISSING_ID", 400);
    }

    // Fetch task list and group
    const { data: list, error: listErr } = await supabase
      .from("task_lists")
      .select("id, title, token, group_id, groups(name)")
      .eq("id", task_list_id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .single();

    if (listErr || !list) {
      return apiError("Task list not found", "NOT_FOUND", 404);
    }

    // Fetch task items (with assignees for pending context)
    const { data: items, error: itemsErr } = await supabase
      .from("task_items")
      .select("text, status, due_at, assigned_member_id")
      .eq("task_list_id", task_list_id);

    if (itemsErr) throw itemsErr;

    const allItems = items || [];
    const nowIso = new Date().toISOString();
    const completedItems = allItems.filter(
      (i) => i.status === "done" || i.status === "verified"
    ).length;

    const pendingRows = allItems.filter((i) => i.status === "pending");
    const assigneeIds = [
      ...new Set(
        pendingRows
          .map((i) => i.assigned_member_id)
          .filter(Boolean) as string[]
      ),
    ];
    const nameById: Record<string, string> = {};
    if (assigneeIds.length > 0) {
      const { data: members } = await supabase
        .from("members")
        .select("id, name")
        .in("id", assigneeIds);
      for (const m of members || []) nameById[m.id] = m.name;
    }

    const pendingItems = pendingRows.map((i) => {
      const who = i.assigned_member_id
        ? nameById[i.assigned_member_id]
        : null;
      return who ? `${i.text} (@${who})` : i.text;
    });

    const overdueCount = pendingRows.filter(
      (i) => i.due_at && i.due_at < nowIso
    ).length;

    const grp: any = list.groups;
    const groupName = (Array.isArray(grp) ? grp[0]?.name : grp?.name) || "Team";

    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://whatsapp-task-tracker.vercel.app";
    const link = `${appUrl}/t/${list.token}`;

    const message = await draftContextualReminder({
      taskListTitle: list.title,
      groupName,
      totalItems: allItems.length,
      completedItems,
      pendingItems,
      overdueCount,
      link,
      language,
      tone,
    });

    return apiSuccess({
      message,
      task_list_id,
      language,
      tone,
    });
  } catch (err: unknown) {
    console.error("POST /api/admin/ai/draft-reminder error:", err);
    return apiError("Failed to draft AI reminder", "AI_REMINDER_ERROR", 500);
  }
}
