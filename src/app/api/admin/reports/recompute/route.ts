import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { apiError, apiSuccess } from "@/lib/errors";
import { calendarDateInTimeZone } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const body = await req.json().catch(() => ({}));
    const timeZone = admin.timezone || "Asia/Kolkata";
    const todayStr = calendarDateInTimeZone(new Date(), timeZone);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const defaultFrom = calendarDateInTimeZone(thirtyDaysAgo, timeZone);

    const from = body.from || defaultFrom;
    const to = body.to || todayStr;

    // Fetch active groups for this org
    const { data: groups, error: groupsErr } = await supabase
      .from("groups")
      .select("id")
      .eq("org_id", admin.orgId)
      .is("deleted_at", null);

    if (groupsErr) throw groupsErr;

    const groupIds = (groups || []).map((g) => g.id);
    if (groupIds.length === 0) {
      return apiSuccess({ ok: true, daysProcessed: 0, rowsUpserted: 0 });
    }

    // Fetch all task lists in this date range
    const { data: lists, error: listsErr } = await supabase
      .from("task_lists")
      .select("id, group_id, list_date, created_at, shared_at")
      .eq("org_id", admin.orgId)
      .gte("list_date", from)
      .lte("list_date", to)
      .is("deleted_at", null);

    if (listsErr) throw listsErr;

    const listIds = (lists || []).map((l) => l.id);

    // Fetch items and completions
    let items: Array<{
      id: string;
      task_list_id: string;
      status: string;
      due_at: string | null;
      completed_at: string | null;
    }> = [];

    if (listIds.length > 0) {
      const { data: itemRows } = await supabase
        .from("task_items")
        .select("id, task_list_id, status, due_at, completed_at")
        .in("task_list_id", listIds);
      items = itemRows || [];
    }

    const itemsByList = new Map<string, typeof items>();
    for (const it of items) {
      const arr = itemsByList.get(it.task_list_id) || [];
      arr.push(it);
      itemsByList.set(it.task_list_id, arr);
    }

    // Group lists by date and group_id
    const listsByDateAndGroup = new Map<string, typeof lists>();
    for (const l of lists || []) {
      const key = `${l.list_date}_${l.group_id}`;
      const arr = listsByDateAndGroup.get(key) || [];
      arr.push(l);
      listsByDateAndGroup.set(key, arr);
    }

    // Walk dates
    let daysCount = 0;
    let rowsUpserted = 0;
    const curDate = new Date(`${from}T12:00:00Z`);
    const endDate = new Date(`${to}T12:00:00Z`);
    const nowIso = new Date().toISOString();

    while (curDate <= endDate) {
      const dStr = curDate.toISOString().slice(0, 10);
      daysCount++;

      for (const grp of groups || []) {
        const key = `${dStr}_${grp.id}`;
        const dayLists = listsByDateAndGroup.get(key) || [];

        let createdCount = 0;
        let doneCount = 0;
        let verifiedCount = 0;
        let overdueCount = 0;
        const responseTimes: number[] = [];

        for (const dl of dayLists) {
          const dlItems = itemsByList.get(dl.id) || [];
          createdCount += dlItems.length;

          for (const it of dlItems) {
            const isDone = it.status === "done" || it.status === "verified";
            if (isDone) doneCount++;
            if (it.status === "verified") verifiedCount++;
            if (it.due_at && it.status === "pending" && it.due_at < nowIso) {
              overdueCount++;
            }

            if (isDone && it.completed_at && (dl.shared_at || dl.created_at)) {
              const diffMs =
                new Date(it.completed_at).getTime() -
                new Date((dl.shared_at || dl.created_at)).getTime();
              if (diffMs > 0) {
                responseTimes.push(Math.round(diffMs / (1000 * 60)));
              }
            }
          }
        }

        const avgMins =
          responseTimes.length > 0
            ? Math.round(
                responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
              )
            : null;

        const { error: upsertErr } = await supabase
          .from("daily_stats")
          .upsert(
            {
              org_id: admin.orgId,
              group_id: grp.id,
              stat_date: dStr,
              tasks_created: createdCount,
              tasks_done: doneCount,
              tasks_verified: verifiedCount,
              tasks_overdue: overdueCount,
              avg_response_minutes: avgMins,
            },
            { onConflict: "org_id,group_id,stat_date" }
          );

        if (!upsertErr) {
          rowsUpserted++;
        }
      }

      curDate.setUTCDate(curDate.getUTCDate() + 1);
    }

    return apiSuccess({
      ok: true,
      from,
      to,
      daysProcessed: daysCount,
      rowsUpserted,
    });
  } catch (err: unknown) {
    console.error("POST /api/admin/reports/recompute error:", err);
    return apiError("Failed to recompute statistics", "RECOMPUTE_ERROR", 500);
  }
}
