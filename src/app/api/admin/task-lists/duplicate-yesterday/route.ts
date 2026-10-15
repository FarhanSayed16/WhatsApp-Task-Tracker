import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { calendarDateInTimeZone } from "@/lib/utils";
import { yesterdayInTimeZone } from "@/lib/cronHelpers";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { generateUniqueTaskToken } from "@/lib/tokens";

/**
 * Clone yesterday's (org-TZ) task lists into today's drafts.
 * Skips lists that already exist today with the same title+group.
 */
export async function POST(_req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const tz = admin.timezone || DEFAULT_TIMEZONE;
    const yesterday = yesterdayInTimeZone(tz);
    const today = calendarDateInTimeZone(new Date(), tz);

    const { data: sourceLists, error: srcErr } = await supabase
      .from("task_lists")
      .select(
        "id, group_id, title, due_at, recurrence, task_items(text, position, priority, assigned_member_id)"
      )
      .eq("org_id", admin.orgId)
      .eq("list_date", yesterday)
      .is("deleted_at", null)
      .neq("status", "archived");

    if (srcErr) throw srcErr;

    if (!sourceLists || sourceLists.length === 0) {
      return apiSuccess({
        created: 0,
        skipped: 0,
        message: `No task lists found for ${yesterday}`,
      });
    }

    let created = 0;
    let skipped = 0;
    const createdIds: string[] = [];

    for (const src of sourceLists) {
      const { data: existing } = await supabase
        .from("task_lists")
        .select("id")
        .eq("org_id", admin.orgId)
        .eq("group_id", src.group_id)
        .eq("title", src.title)
        .eq("list_date", today)
        .is("deleted_at", null)
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      const token = await generateUniqueTaskToken();
      const parentRec = src.recurrence as Record<string, unknown> | null;
      // Don't copy schedule onto the daily clone — mark as manual duplicate
      const recurrence =
        parentRec && parentRec.freq
          ? { auto_generated: true, source: "duplicate_yesterday", parent_list_id: src.id }
          : { auto_generated: true, source: "duplicate_yesterday", parent_list_id: src.id };

      const { data: newList, error: createErr } = await supabase
        .from("task_lists")
        .insert({
          org_id: admin.orgId,
          group_id: src.group_id,
          title: src.title,
          list_date: today,
          token,
          status: "draft",
          due_at: null,
          recurrence,
        })
        .select("id")
        .single();

      if (createErr || !newList) {
        console.error("duplicate-yesterday create error:", createErr);
        continue;
      }

      const items = Array.isArray(src.task_items) ? src.task_items : [];
      if (items.length > 0) {
        await supabase.from("task_items").insert(
          items.map(
            (
              item: {
                text: string;
                position?: number;
                priority?: string;
                assigned_member_id?: string | null;
              },
              idx: number
            ) => ({
              task_list_id: newList.id,
              text: item.text,
              position: item.position ?? idx,
              priority: item.priority || "normal",
              assigned_member_id: item.assigned_member_id || null,
              status: "pending",
            })
          )
        );
      }

      created++;
      createdIds.push(newList.id);
    }

    return apiSuccess({
      created,
      skipped,
      created_ids: createdIds,
      from_date: yesterday,
      to_date: today,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
