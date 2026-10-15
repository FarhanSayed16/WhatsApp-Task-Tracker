import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { recordOpenSchema } from "@/lib/validation";
import { apiError, apiSuccess } from "@/lib/errors";
import { checkPublicTokenRateLimit } from "@/lib/rateLimit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return apiError("Invalid token", "INVALID_TOKEN", 400);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const rateLimit = await checkPublicTokenRateLimit(ip, token);
  if (!rateLimit.allowed) {
    return apiError(
      "Too many requests. Please wait a moment.",
      "RATE_LIMITED",
      429
    );
  }

  try {
    const body = await req.json();
    const result = recordOpenSchema.safeParse(body);
    if (!result.success) {
      return apiError("Invalid member ID", "VALIDATION_ERROR", 400);
    }
    const { member_id } = result.data;

    const { data: taskList, error: listError } = await supabaseAdmin
      .from("task_lists")
      .select("id, group_id, deleted_at")
      .eq("token", token)
      .is("deleted_at", null)
      .single();

    if (listError || !taskList) {
      return apiError("Task list not found or link has expired", "NOT_FOUND", 404);
    }

    const { data: member, error: memberError } = await supabaseAdmin
      .from("members")
      .select("id, active, deleted_at")
      .eq("id", member_id)
      .eq("group_id", taskList.group_id)
      .eq("active", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (memberError || !member) {
      return apiError("Member not found in this group", "NOT_FOUND", 400);
    }

    const now = new Date().toISOString();

    // Insert first; on unique conflict, increment (handles concurrent opens)
    const { error: insertError } = await supabaseAdmin.from("opens").insert({
      task_list_id: taskList.id,
      member_id,
      first_opened_at: now,
      last_opened_at: now,
      open_count: 1,
    });

    if (insertError) {
      const isConflict =
        insertError.code === "23505" ||
        /duplicate|unique/i.test(insertError.message || "");

      if (!isConflict) {
        return apiError("Failed to record open", "DB_ERROR", 500);
      }

      const { data: existingOpen } = await supabaseAdmin
        .from("opens")
        .select("id, open_count")
        .eq("task_list_id", taskList.id)
        .eq("member_id", member_id)
        .maybeSingle();

      if (existingOpen) {
        await supabaseAdmin
          .from("opens")
          .update({
            last_opened_at: now,
            open_count: (existingOpen.open_count || 1) + 1,
          })
          .eq("id", existingOpen.id);
      }
    }

    return apiSuccess({
      recorded: true,
      member_id,
      task_list_id: taskList.id,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to record open";
    return apiError(message, "SERVER_ERROR", 500);
  }
}
