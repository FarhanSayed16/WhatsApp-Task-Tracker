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

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
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

    // 1. Fetch task list
    const { data: taskList, error: listError } = await supabaseAdmin
      .from("task_lists")
      .select("id, group_id, deleted_at")
      .eq("token", token)
      .is("deleted_at", null)
      .single();

    if (listError || !taskList) {
      return apiError("Task list not found or link has expired", "NOT_FOUND", 404);
    }

    // 2. Verify member belongs to this group
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

    // 3. Upsert open record
    const { data: existingOpen } = await supabaseAdmin
      .from("opens")
      .select("id, open_count")
      .eq("task_list_id", taskList.id)
      .eq("member_id", member_id)
      .maybeSingle();

    const now = new Date().toISOString();

    if (existingOpen) {
      await supabaseAdmin
        .from("opens")
        .update({
          last_opened_at: now,
          open_count: (existingOpen.open_count || 1) + 1,
        })
        .eq("id", existingOpen.id);
    } else {
      await supabaseAdmin
        .from("opens")
        .insert({
          task_list_id: taskList.id,
          member_id: member_id,
          first_opened_at: now,
          last_opened_at: now,
          open_count: 1,
        });
    }

    return apiSuccess({
      recorded: true,
      member_id,
      task_list_id: taskList.id,
    });
  } catch (err: any) {
    return apiError(err.message || "Failed to record open", "SERVER_ERROR", 500);
  }
}
