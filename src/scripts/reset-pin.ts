import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

async function main() {
  const newPin = process.argv[2];
  if (!newPin || !/^\d{6}$/.test(newPin)) {
    console.error("Usage: npm run reset-pin <6-digit-pin>");
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your environment.");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  console.log(`Hashing new PIN: ${newPin}...`);
  const pinHash = await bcrypt.hash(newPin, 10);

  // Check if admin exists
  const { data: admin, error: fetchError } = await supabase
    .from("admin")
    .select("id, session_version")
    .limit(1)
    .single();

  if (fetchError || !admin) {
    console.error("Could not find admin row in database. Ensure Phase 2 schema & seed has been run.", fetchError);
    process.exit(1);
  }

  const nextVersion = (admin.session_version || 1) + 1;

  const { error: updateError } = await supabase
    .from("admin")
    .update({
      pin_hash: pinHash,
      session_version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", admin.id);

  if (updateError) {
    console.error("Failed to update PIN:", updateError);
    process.exit(1);
  }

  console.log(`✅ PIN updated successfully! Session version incremented to ${nextVersion} (all previous sessions revoked).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
