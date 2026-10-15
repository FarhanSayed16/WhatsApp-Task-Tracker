import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/errors";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return apiError("Unauthorized", "UNAUTHORIZED", 401);
  }

  return apiSuccess({
    id: admin.adminId,
    orgId: admin.orgId,
    name: admin.name,
    role: admin.role,
    timezone: admin.timezone,
    sessionVersion: admin.sessionVersion,
  });
}
