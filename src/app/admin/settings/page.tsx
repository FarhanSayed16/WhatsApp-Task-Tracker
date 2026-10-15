import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-slate-400 hover:text-slate-600">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
      </div>

      <div className="space-y-4">
        <div className="p-6 rounded-2xl glass-panel space-y-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">Security & PIN</h2>
          <p className="text-xs text-slate-500">Change the 6-digit access PIN. Updating PIN revokes active sessions on all other devices.</p>
          <div className="pt-2">
            <button className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium">
              Change PIN
            </button>
          </div>
        </div>

        <div className="p-6 rounded-2xl glass-panel space-y-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">Data Export & Backup</h2>
          <p className="text-xs text-slate-500">Download a complete CSV backup of all tasks, groups, and completions.</p>
          <div className="pt-2">
            <a
              href="/api/admin/export"
              className="inline-block px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500"
            >
              Export CSV Backup
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
