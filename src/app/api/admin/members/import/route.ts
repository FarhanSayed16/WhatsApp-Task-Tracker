import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { importMembersSchema, validateBody } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const body = await req.json();
    const data = validateBody(importMembersSchema, body);

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

    const { data: existingMembers } = await supabase
      .from("members")
      .select("name")
      .eq("group_id", data.group_id)
      .is("deleted_at", null);

    const existingNames = new Set(
      (existingMembers || []).map((m) => m.name.toLowerCase().trim())
    );

    const lines = data.csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const validInserts: Array<{
      group_id: string;
      name: string;
      phone: string | null;
      active: boolean;
    }> = [];

    const duplicates: string[] = [];
    const errors: string[] = [];
    const seenInBatch = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (
        i === 0 &&
        (line.toLowerCase().startsWith("name,") || line.toLowerCase() === "name")
      ) {
        continue;
      }

      const parts = line
        .split(",")
        .map((p) => p.replace(/^["']|["']$/g, "").trim());
      const rawName = parts[0];
      const rawPhone = parts[1] || "";

      if (!rawName) {
        errors.push(`Row ${i + 1}: Member name cannot be empty`);
        continue;
      }

      const lowerName = rawName.toLowerCase();

      if (existingNames.has(lowerName) || seenInBatch.has(lowerName)) {
        duplicates.push(rawName);
        continue;
      }

      let cleanPhone: string | null = null;
      if (rawPhone) {
        const digitsOnly = rawPhone.replace(/\D/g, "");
        if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
          cleanPhone = digitsOnly;
        } else {
          // Skip invalid phone rows entirely (P2-15)
          errors.push(
            `Row ${i + 1} (${rawName}): Phone "${rawPhone}" is invalid (must be 10-15 digits) — skipped`
          );
          continue;
        }
      }

      seenInBatch.add(lowerName);
      validInserts.push({
        group_id: data.group_id,
        name: rawName,
        phone: cleanPhone,
        active: true,
      });
    }

    let importedCount = 0;
    if (validInserts.length > 0) {
      const { error: insertErr } = await supabase
        .from("members")
        .insert(validInserts);

      if (insertErr) throw insertErr;
      importedCount = validInserts.length;
    }

    return apiSuccess({
      imported: importedCount,
      skipped: duplicates.length,
      duplicates,
      errors,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
