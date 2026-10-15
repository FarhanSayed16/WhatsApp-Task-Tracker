import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/errors";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return apiError("Invalid token", "INVALID_TOKEN", 400);

  return apiSuccess({
    status: "active",
    token,
    message: "Member task list public data placeholder",
  });
}
