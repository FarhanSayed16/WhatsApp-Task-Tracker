import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  let dbStatus: "connected" | "error" = "error";
  try {
    const { error } = await supabase
      .from("organizations")
      .select("id")
      .limit(1);

    if (!error) {
      dbStatus = "connected";
    }
  } catch {
    dbStatus = "error";
  }

  return NextResponse.json(
    {
      status: dbStatus === "connected" ? "ok" : "degraded",
      db: dbStatus,
      timestamp: new Date().toISOString(),
      version: "0.1.0",
    },
    {
      status: dbStatus === "connected" ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
