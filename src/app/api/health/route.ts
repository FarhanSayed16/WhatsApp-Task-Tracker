import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  let dbStatus = "disconnected";
  try {
    const { error } = await supabase.from("organizations").select("id").limit(1);
    if (!error) {
      dbStatus = "connected";
    }
  } catch {
    dbStatus = "disconnected";
  }

  return NextResponse.json({
    status: "ok",
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
}
