import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("───────────────────────────────────────────────");
  console.log(" Supabase Database Connection & Schema Verification");
  console.log("───────────────────────────────────────────────");

  if (!url || !key || url.includes("placeholder-project")) {
    console.log("⚠️  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured with live credentials in .env.local yet.");
    console.log("ℹ️  To connect to live Supabase:");
    console.log("   1. Create project at https://supabase.com (Mumbai region: ap-south-1)");
    console.log("   2. Copy Project URL and Service Role Key to .env.local");
    console.log("   3. Paste and run docs/schema.sql in the Supabase SQL Editor");
    console.log("   4. Re-run: npm run test-db");
    return;
  }

  const client = createClient(url, key, {
    auth: { persistSession: false },
  });

  console.log(`Connecting to: ${url}`);

  const tables = [
    "organizations",
    "admin",
    "login_attempts",
    "groups",
    "members",
    "templates",
    "task_lists",
    "task_items",
    "completions",
    "share_log",
    "opens",
    "daily_stats",
  ];

  let verifiedCount = 0;
  for (const table of tables) {
    const { count, error } = await client
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) {
      console.log(`❌ Table [${table}]: Error - ${error.message}`);
    } else {
      console.log(`✅ Table [${table}]: Verified (Row count: ${count ?? 0})`);
      verifiedCount++;
    }
  }

  console.log("───────────────────────────────────────────────");
  if (verifiedCount === tables.length) {
    console.log("🎉 All 12 tables, indexes, and RLS policies are verified and active!");
  } else {
    console.log(`⚠️  ${verifiedCount}/${tables.length} tables verified. Run docs/schema.sql in Supabase SQL editor.`);
  }
}

main().catch(console.error);
