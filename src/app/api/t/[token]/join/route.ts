import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { joinAsMemberSchema } from "@/lib/validation";
import { apiError, apiSuccess } from "@/lib/errors";
import { checkPublicTokenRateLimit } from "@/lib/rateLimit";
import { canMemberMutateList, computeLinkStatus } from "@/lib/utils";
import { DEFAULT_TIMEZONE } from "@/lib/constants";

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
    const parsed = joinAsMemberSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message || "Enter your name",
        "VALIDATION_ERROR",
        400
      );
    }
    const name = parsed.data.name.replace(/\s+/g, " ");

    const { data: taskList, error: listError } = await supabaseAdmin
      .from("task_lists")
      .select("id, org_id, group_id, list_date, due_at, status, deleted_at")
      .eq("token", token)
      .maybeSingle();

    if (listError || !taskList) {
      return apiError("Task list not found or link has expired", "NOT_FOUND", 404);
    }

    let timeZone = DEFAULT_TIMEZONE;
    const { data: adminRow } = await supabaseAdmin
      .from("admin")
      .select("timezone")
      .eq("org_id", taskList.org_id)
      .limit(1)
      .maybeSingle();
    if (adminRow?.timezone) timeZone = adminRow.timezone;

    const { status: linkStatus } = computeLinkStatus(
      taskList.deleted_at,
      taskList.list_date,
      taskList.due_at,
      { listStatus: taskList.status, timeZone }
    );

    if (!canMemberMutateList(linkStatus)) {
      return apiError("This list is read-only", "FORBIDDEN", 403);
    }

    const { data: existing } = await supabaseAdmin
      .from("members")
      .select("id, group_id, name, phone, active, created_at, updated_at")
      .eq("group_id", taskList.group_id)
      .eq("active", true)
      .is("deleted_at", null);

    const match = (existing || []).find(
      (m) => m.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (match) {
      return apiSuccess(match);
    }

    const { data: created, error: insertErr } = await supabaseAdmin
      .from("members")
      .insert({
        group_id: taskList.group_id,
        name,
        phone: null,
        active: true,
      })
      .select("id, group_id, name, phone, active, created_at, updated_at")
      .single();

    if (insertErr || !created) {
      return apiError("Could not save your name", "DB_ERROR", 500);
    }

    return apiSuccess(created, undefined, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to join";
    return apiError(message, "SERVER_ERROR", 500);
  }
}
