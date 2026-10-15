import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { ReportSummary, ReportGroupStat, ReportMemberStat } from "@/types";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#059669",
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#065f46",
  },
  subtitle: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 3,
  },
  kpiGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  kpiCard: {
    width: "23%",
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  kpiLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0f172a",
  },
  kpiSub: {
    fontSize: 7,
    color: "#94a3b8",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 6,
    marginTop: 10,
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableHeader: {
    backgroundColor: "#f1f5f9",
    fontWeight: "bold",
    fontSize: 8,
    color: "#475569",
  },
  colGroup: { width: "40%" },
  colTasks: { width: "15%", textAlign: "center" },
  colDone: { width: "15%", textAlign: "center" },
  colRate: { width: "15%", textAlign: "center" },
  colAvg: { width: "15%", textAlign: "right" },

  colMember: { width: "35%" },
  colMemberGrp: { width: "25%" },
  colMemberDone: { width: "15%", textAlign: "center" },
  colMemberOnTime: { width: "15%", textAlign: "center" },
  colMemberScore: { width: "10%", textAlign: "right" },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    textAlign: "center",
    fontSize: 7,
    color: "#94a3b8",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 6,
  },
});

export interface ReportPdfData {
  orgName: string;
  dateRangeLabel: string;
  generatedAt: string;
  summary: ReportSummary;
  groups: ReportGroupStat[];
  members: ReportMemberStat[];
}

export function ReportPdfDocument({ data }: { data: ReportPdfData }) {
  const { orgName, dateRangeLabel, generatedAt, summary, groups, members } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{orgName}</Text>
          <Text style={styles.subtitle}>
            Executive Task &amp; Performance Report • {dateRangeLabel}
          </Text>
        </View>

        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Tasks</Text>
            <Text style={styles.kpiValue}>{summary.totalTasks}</Text>
            <Text style={styles.kpiSub}>{summary.activeGroups} active groups</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Completion Rate</Text>
            <Text style={styles.kpiValue}>{summary.completionRate}%</Text>
            <Text style={styles.kpiSub}>{summary.completedTasks} completed</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>On-Time Rate</Text>
            <Text style={styles.kpiValue}>{summary.onTimeRate}%</Text>
            <Text style={styles.kpiSub}>{summary.verifiedTasks} verified</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Avg Response</Text>
            <Text style={styles.kpiValue}>{summary.avgResponseMinutes}m</Text>
            <Text style={styles.kpiSub}>{summary.overdueTasks} overdue</Text>
          </View>
        </View>

        {/* Group Performance Table */}
        <Text style={styles.sectionTitle}>Group Performance Breakdown</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.colGroup}>Group Name</Text>
            <Text style={styles.colTasks}>Tasks</Text>
            <Text style={styles.colDone}>Completed</Text>
            <Text style={styles.colRate}>Rate</Text>
            <Text style={styles.colAvg}>Avg Speed</Text>
          </View>
          {groups.map((g) => (
            <View key={g.group_id} style={styles.tableRow}>
              <Text style={styles.colGroup}>{g.group_name}</Text>
              <Text style={styles.colTasks}>{g.total_tasks}</Text>
              <Text style={styles.colDone}>{g.completed_tasks}</Text>
              <Text style={styles.colRate}>{g.completion_rate}%</Text>
              <Text style={styles.colAvg}>{g.avg_response_mins}m</Text>
            </View>
          ))}
          {groups.length === 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.colGroup}>No group activity in this period</Text>
            </View>
          )}
        </View>

        {/* Member Performance Table */}
        <Text style={styles.sectionTitle}>Member Performance Leaderboard</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.colMember}>Member</Text>
            <Text style={styles.colMemberGrp}>Group</Text>
            <Text style={styles.colMemberDone}>Done</Text>
            <Text style={styles.colMemberOnTime}>On-Time</Text>
            <Text style={styles.colMemberScore}>Score</Text>
          </View>
          {members.slice(0, 15).map((m) => (
            <View key={m.member_id} style={styles.tableRow}>
              <Text style={styles.colMember}>{m.name}</Text>
              <Text style={styles.colMemberGrp}>{m.group_name}</Text>
              <Text style={styles.colMemberDone}>{m.completed_count}</Text>
              <Text style={styles.colMemberOnTime}>{m.on_time_rate}%</Text>
              <Text style={styles.colMemberScore}>{m.score}</Text>
            </View>
          ))}
          {members.length === 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.colMember}>No member activity recorded</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Generated on {generatedAt} • WhatsApp Task Tracker Analytics • Confidential
        </Text>
      </Page>
    </Document>
  );
}

export async function generateReportPdfBuffer(data: ReportPdfData): Promise<Buffer> {
  const element = React.createElement(ReportPdfDocument, { data });
  // @ts-expect-error react-pdf renderToBuffer accepts Document element
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
