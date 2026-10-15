/**
 * Seeds a demo group + member for local testing.
 * Phone: India 9324826414 → wa.me/919324826414
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const ADMIN_ID = "00000000-0000-0000-0000-000000000001";
const TEST_PHONE = "919324826414"; // +91 India

const { data: existing } = await supabase
  .from("groups")
  .select("id, name")
  .eq("org_id", ORG_ID)
  .is("deleted_at", null)
  .ilike("name", "Test WhatsApp Group")
  .maybeSingle();

let groupId = existing?.id;

if (!groupId) {
  const { data: g, error } = await supabase
    .from("groups")
    .insert({
      org_id: ORG_ID,
      name: "Test WhatsApp Group",
      description: "Demo group for local testing — share via wa.me",
      verify_required: true,
      sort_order: 0,
      created_by: ADMIN_ID,
    })
    .select("id")
    .single();
  if (error) {
    console.error("Failed to create group:", error.message);
    process.exit(1);
  }
  groupId = g.id;
  console.log("Created group:", groupId);
} else {
  console.log("Group already exists:", groupId);
}

const { data: memberExisting } = await supabase
  .from("members")
  .select("id, name, phone")
  .eq("group_id", groupId)
  .is("deleted_at", null)
  .eq("phone", TEST_PHONE)
  .maybeSingle();

if (!memberExisting) {
  const { error: mErr } = await supabase.from("members").insert({
    group_id: groupId,
    name: "Test Member (You)",
    phone: TEST_PHONE,
    active: true,
  });
  if (mErr) {
    console.error("Failed to create member:", mErr.message);
    process.exit(1);
  }
  console.log("Created member with phone", TEST_PHONE);
} else {
  console.log("Member already exists:", memberExisting.id);
}

// Store default share phone on org settings
const { data: org } = await supabase
  .from("organizations")
  .select("settings")
  .eq("id", ORG_ID)
  .single();
const settings = { ...(org?.settings || {}), default_wa_phone: TEST_PHONE };
await supabase.from("organizations").update({ settings }).eq("id", ORG_ID);
console.log("Org default_wa_phone set to", TEST_PHONE);
console.log("Done. Open /admin/tasks/new and select “Test WhatsApp Group”.");
