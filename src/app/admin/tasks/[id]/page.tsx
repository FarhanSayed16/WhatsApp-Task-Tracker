import Link from "next/link";

export default async function TaskListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/tasks" className="text-slate-400 hover:text-slate-600">
          ← Tasks
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Task List Details</h1>
      </div>

      <div className="p-6 rounded-2xl glass-panel space-y-2">
        <p className="text-sm text-slate-500">Task List ID: {id}</p>
        <p className="text-sm text-slate-500">Live item statuses, verify buttons, and WhatsApp reminder buttons placeholder</p>
      </div>
    </div>
  );
}
