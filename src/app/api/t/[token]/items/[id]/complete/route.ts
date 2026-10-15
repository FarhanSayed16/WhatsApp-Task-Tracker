import { NextRequest } from "next/server";
import { completeItemSchema } from "@/lib/validation";
import { apiError, apiSuccess } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  try {
    const body = await req.json();
    const result = completeItemSchema.safeParse(body);
    if (!result.success) {
      return apiError("Invalid completion payload", "VALIDATION_ERROR", 400);
    }
    return apiSuccess({ token, itemId: id, status: "done", message: "Item completed by member placeholder" });
  } catch {
    return apiError("Malformed JSON body", "BAD_REQUEST", 400);
  }
}
