import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess } from "@/lib/errors";
import { checkPublicTokenRateLimit } from "@/lib/rateLimit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return apiError("Invalid token", "INVALID_TOKEN", 400);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const rateLimit = await checkPublicTokenRateLimit(ip, token);
  if (!rateLimit.allowed) {
    return apiError(
      "Too many requests. Please wait before refreshing again.",
      "RATE_LIMITED",
      429
    );
  }

  try {
    // 1. Fetch task list with group information
    const { data: taskList, error: listError } = await supabaseAdmin
      .from("task_lists")
      .select(`
        id,
        org_id,
        group_id,
        title,
        list_date,
        due_at,
        token,
        status,
        deleted_at,
        group:groups!group_id (
          id,
          name,
          verify_required
        )
      `)
      .eq("token", token)
      .is("deleted_at", null)
      .single();

    if (listError || !taskList) {
      return apiError("Task list not found or link has expired", "NOT_FOUND", 404);
    }

    const groupInfo = Array.isArray(taskList.group) ? taskList.group[0] : taskList.group;

    // 2. Compute expiry & status using Core Business Rules
    let expiresAt: string;
    if (taskList.due_at) {
      expiresAt = taskList.due_at;
    } else {
      const listDateObj = new Date(taskList.list_date + "T23:59:59.999Z");
      expiresAt = new Date(listDateObj.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    const isPastExpiry = new Date(expiresAt).getTime() < Date.now();
    let computedStatus: "active" | "readonly" | "expired" = "active";

    if (isPastExpiry || taskList.status === "archived") {
      computedStatus = "readonly";
    } else if (taskList.status === "completed") {
      computedStatus = "readonly";
    } else {
      computedStatus = "active";
    }

    // 3. Fetch items in order
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("task_items")
      .select("id, text, position, priority, assigned_member_id, due_at, status, completed_by, completed_at, verified_at")
      .eq("task_list_id", taskList.id)
      .order("position", { ascending: true });

    if (itemsError) {
      return apiError("Failed to fetch task items", "DB_ERROR", 500);
    }

    // 4. Fetch active members for this group
    const { data: members, error: membersError } = await supabaseAdmin
      .from("members")
      .select("id, name, phone, active")
      .eq("group_id", taskList.group_id)
      .eq("active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (membersError) {
      return apiError("Failed to fetch group members", "DB_ERROR", 500);
    }

    // 5. Fetch completions for items
    const itemIds = (items || []).map((i) => i.id);
    let completions: any[] = [];
    if (itemIds.length > 0) {
      const { data: compData } = await supabaseAdmin
        .from("completions")
        .select("id, task_item_id, member_id, status, note, completed_at, verified_at")
        .in("task_item_id", itemIds);
      completions = compData || [];
    }

    return apiSuccess({
      status: computedStatus,
      expires_at: expiresAt,
      verify_required: Boolean(groupInfo?.verify_required),
      task_list: {
        id: taskList.id,
        token: taskList.token,
        title: taskList.title,
        group_name: groupInfo?.name || "Group",
        list_date: taskList.list_date,
        due_at: taskList.due_at,
        status: taskList.status,
      },
      items: items || [],
      members: members || [],
      completions: completions,
    });
  } catch (err: any) {
    return apiError(err.message || "Failed to load public task list", "SERVER_ERROR", 500);
  }
}
