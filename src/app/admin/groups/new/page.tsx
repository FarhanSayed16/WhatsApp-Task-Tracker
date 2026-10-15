import Link from "next/link";

export default function NewGroupPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/groups" className="text-slate-400 hover:text-slate-600">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New Group</h1>
      </div>

      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <p className="text-sm text-slate-500">Group creation form placeholder</p>
      </div>
    </div>
  );
}
