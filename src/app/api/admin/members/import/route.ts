import { NextRequest } from "next/server";
import { getServerSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/errors";

export async function POST(_req: NextRequest) {
  const session = await getServerSession();
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);
  return apiSuccess({ imported: 0, message: "Member CSV import placeholder" });
}
