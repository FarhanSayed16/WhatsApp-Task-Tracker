import Link from "next/link";

export default function ReportsPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports & Analytics</h1>
          <p className="text-sm text-slate-500">Group performance, trends, and exportable data</p>
        </div>
      </div>

      <div className="p-12 text-center rounded-2xl glass-panel text-slate-500">
        Analytics & Reports feature (Phase 13).
      </div>
    </div>
  );
}
