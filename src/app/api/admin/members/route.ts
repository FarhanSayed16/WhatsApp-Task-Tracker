import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { createMemberSchema, validateBody } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("group_id");
    const active = searchParams.get("active");
    const search = searchParams.get("search")?.trim();

    if (!groupId) {
      return apiError("group_id is required", "VALIDATION_ERROR", 400);
    }

    // Scope via parent group.org_id (members table has no org_id column)
    const { data: group, error: groupErr } = await supabase
      .from("groups")
      .select("id")
      .eq("id", groupId)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .single();

    if (groupErr || !group) {
      return apiError("Group not found", "NOT_FOUND", 404);
    }

    let query = supabase
      .from("members")
      .select("*")
      .eq("group_id", groupId)
      .is("deleted_at", null);

    if (active !== null && active !== undefined && active !== "") {
      query = query.eq("active", active === "true");
    }
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    query = query.order("name", { ascending: true });

    const { data: members, error } = await query;
    if (error) throw error;

    const memberList = members || [];
    const memberIds = memberList.map((m) => m.id);

    const completionsCount: Record<string, number> = {};
    if (memberIds.length > 0) {
      const { data: completions } = await supabase
        .from("completions")
        .select("id, member_id")
        .in("member_id", memberIds);

      if (completions) {
        for (const c of completions) {
          if (c.member_id) {
            completionsCount[c.member_id] =
              (completionsCount[c.member_id] || 0) + 1;
          }
        }
      }
    }

    const enrichedMembers = memberList.map((m) => ({
      ...m,
      completions_count: completionsCount[m.id] || 0,
    }));

    return apiSuccess(enrichedMembers);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const body = await req.json();
    const data = validateBody(createMemberSchema, body);

    const { data: group, error: groupErr } = await supabase
      .from("groups")
      .select("id")
      .eq("id", data.group_id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .single();

    if (groupErr || !group) {
      return apiError("Group not found", "NOT_FOUND", 404);
    }

    const { data: existing } = await supabase
      .from("members")
      .select("id, name")
      .eq("group_id", data.group_id)
      .is("deleted_at", null);

    if (
      existing &&
      existing.some((m) => m.name.toLowerCase() === data.name.toLowerCase())
    ) {
      return apiError(
        `A member with the name "${data.name}" already exists in this group`,
        "DUPLICATE",
        409
      );
    }

    const { data: newMember, error: insertErr } = await supabase
      .from("members")
      .insert({
        group_id: data.group_id,
        name: data.name,
        phone: data.phone || null,
        active: true,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return apiSuccess(newMember, undefined, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
