import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Task Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Overview of WhatsApp group checklists and completion progress
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/tasks/new"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-500 text-sm shadow-sm transition-all"
          >
            + New Task List
          </Link>
          <Link
            href="/admin/groups/new"
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-medium text-sm hover:bg-slate-50 transition-all"
          >
            + New Group
          </Link>
        </div>
      </header>

      {/* KPI Cards Placeholder */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today's Tasks", value: "0", color: "text-emerald-600" },
          { label: "Completed", value: "0", color: "text-blue-600" },
          { label: "Pending", value: "0", color: "text-amber-600" },
          { label: "Overdue", value: "0", color: "text-rose-600" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="p-5 rounded-2xl glass-panel shadow-sm flex flex-col justify-between"
          >
            <span className="text-xs font-medium text-slate-500">{kpi.label}</span>
            <span className={`text-2xl font-bold mt-2 ${kpi.color}`}>{kpi.value}</span>
          </div>
        ))}
      </div>

      {/* Navigation shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/admin/groups"
          className="p-6 rounded-2xl glass-panel hover:border-emerald-500/50 transition-all flex flex-col space-y-2"
        >
          <div className="text-xl">👥</div>
          <h2 className="font-semibold text-slate-900 dark:text-white">Manage Groups</h2>
          <p className="text-xs text-slate-500">Manage student groups, member rosters and verification settings</p>
        </Link>

        <Link
          href="/admin/tasks"
          className="p-6 rounded-2xl glass-panel hover:border-emerald-500/50 transition-all flex flex-col space-y-2"
        >
          <div className="text-xl">📋</div>
          <h2 className="font-semibold text-slate-900 dark:text-white">Task Lists</h2>
          <p className="text-xs text-slate-500">View all past and active task lists, verify items, and resend links</p>
        </Link>

        <Link
          href="/admin/settings"
          className="p-6 rounded-2xl glass-panel hover:border-emerald-500/50 transition-all flex flex-col space-y-2"
        >
          <div className="text-xl">⚙️</div>
          <h2 className="font-semibold text-slate-900 dark:text-white">Settings</h2>
          <p className="text-xs text-slate-500">Change PIN, timezone preferences, and export CSV backups</p>
        </Link>
      </div>
    </div>
  );
}
