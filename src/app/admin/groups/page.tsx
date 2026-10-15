import Link from "next/link";

export default function GroupsListPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Groups</h1>
          <p className="text-sm text-slate-500">WhatsApp groups & member rosters</p>
        </div>
        <Link
          href="/admin/groups/new"
          className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-500 text-sm shadow-sm transition-all"
        >
          + Create Group
        </Link>
      </div>

      <div className="p-12 text-center rounded-2xl glass-panel text-slate-500">
        No groups created yet. Click "+ Create Group" to add your first WhatsApp group.
      </div>
    </div>
  );
}
