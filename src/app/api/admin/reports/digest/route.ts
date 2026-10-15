import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { apiError, apiSuccess } from "@/lib/errors";
import { sendDigestEmail, toReportMemberStat } from "@/lib/email";
import { calendarDateInTimeZone } from "@/lib/utils";
import { buildOrgDigestMetrics } from "@/lib/cronHelpers";
import { DEFAULT_TIMEZONE } from "@/lib/constants";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const body = await req.json().catch(() => ({}));
    const timeZone = admin.timezone || DEFAULT_TIMEZONE;
    const todayStr = calendarDateInTimeZone(new Date(), timeZone);

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("name, settings")
      .eq("id", admin.orgId)
      .single();

    if (orgErr || !org) return apiError("Organization not found", "NOT_FOUND", 404);

    const orgSettings = (org.settings as Record<string, unknown>) || {};
    const digestConfig =
      (orgSettings.report_digest as {
        frequency?: string;
        recipients?: string[];
        day_of_week?: number;
        last_sent_at?: string | null;
      }) || {};

    const recipients = body.recipients || digestConfig.recipients || [];
    if (!recipients || recipients.length === 0) {
      return apiError(
        "No email recipients specified for digest",
        "NO_RECIPIENTS",
        400
      );
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const from = calendarDateInTimeZone(sevenDaysAgo, timeZone);
    const to = todayStr;

    const metrics = await buildOrgDigestMetrics(
      supabase,
      admin.orgId,
      from,
      to
    );

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "https://whatsapp-task-tracker.vercel.app";

    const result = await sendDigestEmail(recipients, {
      orgName: org.name,
      periodLabel: `Past 7 Days: ${from} to ${to}`,
      summary: metrics.summary,
      topPerformers: metrics.topPerformers.map(toReportMemberStat),
      bottomPerformers: metrics.bottomPerformers.map(toReportMemberStat),
      overdueItems: metrics.overdueItems,
      appUrl,
    });

    if (result.success) {
      const updatedDigest = {
        ...digestConfig,
        last_sent_at: new Date().toISOString(),
      };
      await supabase
        .from("organizations")
        .update({
          settings: { ...orgSettings, report_digest: updatedDigest },
        })
        .eq("id", admin.orgId);
    }

    return apiSuccess({
      ok: result.success,
      sentTo: recipients,
      messageId: result.messageId,
      error: result.error,
      summary: metrics.summary,
    });
  } catch (err: unknown) {
    console.error("POST /api/admin/reports/digest error:", err);
    return apiError("Failed to send digest", "DIGEST_ERROR", 500);
  }
}
