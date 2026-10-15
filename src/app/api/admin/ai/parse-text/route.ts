import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/errors";
import { parseTextToTasks } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body.text || "").trim();

    if (!text) {
      return apiError("Text input is required for AI parsing", "EMPTY_TEXT", 400);
    }

    const items = await parseTextToTasks(text);
    return apiSuccess({
      items,
      count: items.length,
    });
  } catch (err: unknown) {
    console.error("POST /api/admin/ai/parse-text error:", err);
    return apiError("Failed to parse text with AI", "AI_PARSE_ERROR", 500);
  }
}
