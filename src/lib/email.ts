import { Resend } from "resend";
import type { ReportSummary, ReportMemberStat, DashboardOverdueItem } from "@/types";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || "WhatsApp Task Tracker <onboarding@resend.dev>";

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export interface DigestEmailData {
  orgName: string;
  periodLabel: string;
  summary: ReportSummary;
  topPerformers: ReportMemberStat[];
  bottomPerformers?: ReportMemberStat[];
  overdueItems: Array<{ text: string; group_name: string; due_at: string }>;
  appUrl: string;
}

/** Map lightweight performer rows into ReportMemberStat for email templates */
export function toReportMemberStat(
  p: {
    name: string;
    completed: number;
    onTimeRate: number;
    avgResponseMinutes: number;
  },
  idx: number
): ReportMemberStat {
  return {
    member_id: `digest-${idx}`,
    name: p.name,
    group_id: "",
    group_name: "—",
    assigned_count: p.completed,
    completed_count: p.completed,
    verified_count: p.completed,
    on_time_count: Math.round((p.onTimeRate / 100) * p.completed),
    on_time_rate: p.onTimeRate,
    avg_response_mins: p.avgResponseMinutes,
    score: Math.round(p.onTimeRate * 0.7 + Math.min(p.completed, 20) * 1.5),
  };
}

export function generateDigestHtml(data: DigestEmailData): string {
  const {
    orgName,
    periodLabel,
    summary,
    topPerformers,
    bottomPerformers = [],
    overdueItems,
    appUrl,
  } = data;

  const topRows = topPerformers.slice(0, 5).map((m, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">#${idx + 1} ${m.name}</td>
      <td style="padding: 10px 12px; color: #64748b; font-size: 13px;">${m.group_name}</td>
      <td style="padding: 10px 12px; text-align: center; font-weight: 600; color: #0f766e;">${m.completed_count}</td>
      <td style="padding: 10px 12px; text-align: center; font-weight: 600; color: #0284c7;">${m.on_time_rate}%</td>
      <td style="padding: 10px 12px; text-align: right;">
        <span style="background: #f0fdf4; color: #166534; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 12px;">
          ${m.score} pts
        </span>
      </td>
    </tr>
  `).join("");

  const bottomRows = bottomPerformers.slice(0, 3).map((m) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">${m.name}</td>
      <td style="padding: 10px 12px; text-align: center; color: #64748b;">${m.completed_count}</td>
      <td style="padding: 10px 12px; text-align: center; color: #b45309;">${m.on_time_rate}%</td>
    </tr>
  `).join("");

  const overdueList = overdueItems.slice(0, 5).map((item) => `
    <li style="margin-bottom: 8px; color: #991b1b; font-size: 13px;">
      <strong>${item.text}</strong> — <span style="color: #64748b;">${item.group_name}</span>
    </li>
  `).join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${orgName} Task Performance Digest</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 32px 28px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">${orgName}</h1>
              <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9; font-weight: 500;">
                Task Performance &amp; Completion Digest (${periodLabel})
              </p>
            </td>
          </tr>

          <!-- KPI Summary Cards -->
          <tr>
            <td style="padding: 24px 28px 12px 28px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="48%" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; text-align: center;">
                    <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #166534; letter-spacing: 0.5px;">Completion Rate</div>
                    <div style="font-size: 26px; font-weight: 800; color: #047857; margin-top: 4px;">${summary.completionRate}%</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${summary.completedTasks} of ${summary.totalTasks} tasks</div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 16px; text-align: center;">
                    <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #075985; letter-spacing: 0.5px;">On-Time Rate</div>
                    <div style="font-size: 26px; font-weight: 800; color: #0284c7; margin-top: 4px;">${summary.onTimeRate}%</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${summary.verifiedTasks} verified</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Quick Stats Row -->
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <div style="display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #475569;">
                <span><strong>${summary.activeGroups}</strong> Active Groups</span>
                <span>•</span>
                <span><strong>${summary.activeMembers}</strong> Active Members</span>
                <span>•</span>
                <span><strong>${summary.avgResponseMinutes}m</strong> Avg Response</span>
              </div>
            </td>
          </tr>

          <!-- Top Performers Table -->
          ${topPerformers.length > 0 ? `
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">
                🏆 Top Performers
              </h3>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; text-align: left; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                <thead>
                  <tr style="background: #f1f5f9; color: #475569; font-weight: 700; font-size: 11px; text-transform: uppercase;">
                    <th style="padding: 8px 12px;">Member</th>
                    <th style="padding: 8px 12px;">Group</th>
                    <th style="padding: 8px 12px; text-align: center;">Done</th>
                    <th style="padding: 8px 12px; text-align: center;">On-Time</th>
                    <th style="padding: 8px 12px; text-align: right;">Score</th>
                  </tr>
                </thead>
                <tbody>
                  ${topRows}
                </tbody>
              </table>
            </td>
          </tr>` : ""}

          ${bottomPerformers.length > 0 ? `
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">
                Needs attention
              </h3>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; text-align: left; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                <thead>
                  <tr style="background: #fff7ed; color: #9a3412; font-weight: 700; font-size: 11px; text-transform: uppercase;">
                    <th style="padding: 8px 12px;">Member</th>
                    <th style="padding: 8px 12px; text-align: center;">Done</th>
                    <th style="padding: 8px 12px; text-align: center;">On-Time</th>
                  </tr>
                </thead>
                <tbody>${bottomRows}</tbody>
              </table>
            </td>
          </tr>` : ""}

          <!-- Overdue Items Alert -->
          ${overdueItems.length > 0 ? `
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px;">
                <h4 style="font-size: 14px; font-weight: 700; color: #991b1b; margin: 0 0 8px 0;">
                  ⚠️ Overdue Tasks Requiring Attention (${overdueItems.length})
                </h4>
                <ul style="margin: 0; padding-left: 20px;">
                  ${overdueList}
                </ul>
              </div>
            </td>
          </tr>` : ""}

          <!-- Action Button -->
          <tr>
            <td style="padding: 12px 28px 32px 28px; text-align: center;">
              <a href="${appUrl}/admin/reports" style="display: inline-block; background: #059669; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 10px; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);">
                Open Interactive Analytics Dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center; font-size: 11px; color: #94a3b8;">
              Sent by WhatsApp Task Tracker • Automated performance digest
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export async function sendDigestEmail(
  recipients: string[],
  data: DigestEmailData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!resend) {
    console.warn("RESEND_API_KEY not configured. Skipping email send. Payload:", {
      recipients,
      summary: data.summary,
    });
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  if (!recipients || recipients.length === 0) {
    return { success: false, error: "No recipients specified" };
  }

  try {
    const html = generateDigestHtml(data);
    const { data: resData, error: resErr } = await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject: `📊 ${data.orgName} Task Performance Digest (${data.periodLabel})`,
      html,
    });

    if (resErr) {
      console.error("Resend API error:", resErr);
      return { success: false, error: resErr.message };
    }

    return { success: true, messageId: resData?.id };
  } catch (err: unknown) {
    console.error("Failed to send digest email:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
