import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { professorCompleteItem } from "@/lib/items";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { id } = await params;

    const result = await professorCompleteItem(id, admin.orgId);
    if (!result) {
      return apiError("Task item not found", "NOT_FOUND", 404);
    }

    return apiSuccess({
      item: result.item,
      completed: true,
      verified: true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
