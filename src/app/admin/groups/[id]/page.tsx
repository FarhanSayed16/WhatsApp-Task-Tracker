import Link from "next/link";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/groups" className="text-slate-400 hover:text-slate-600">
          ← Groups
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Group Details</h1>
      </div>

      <div className="p-6 rounded-2xl glass-panel space-y-2">
        <p className="text-sm text-slate-500">Group ID: {id}</p>
        <p className="text-sm text-slate-500">Group roster and history placeholder</p>
      </div>
    </div>
  );
}
