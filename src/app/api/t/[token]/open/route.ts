import { NextRequest } from "next/server";
import { recordOpenSchema } from "@/lib/validation";
import { apiError, apiSuccess } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const body = await req.json();
    const result = recordOpenSchema.safeParse(body);
    if (!result.success) {
      return apiError("Invalid member ID", "VALIDATION_ERROR", 400);
    }
    return apiSuccess({ token, memberId: result.data.member_id, recorded: true });
  } catch {
    return apiError("Malformed JSON body", "BAD_REQUEST", 400);
  }
}
