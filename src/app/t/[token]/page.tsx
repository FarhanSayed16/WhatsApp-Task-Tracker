import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Group Task Checklist",
  description: "Tick off completed tasks for your WhatsApp group",
};

export default async function PublicMemberTaskPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 flex flex-col items-center">
      <div className="w-full max-w-lg space-y-6">
        {/* Header card */}
        <div className="p-6 rounded-3xl glass-panel shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span>TASK CHECKLIST</span>
            <span>TOKEN: {token}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Daily Task Assignment
          </h1>
          <p className="text-xs text-slate-500">
            Select your name to check off items you have completed. No login needed.
          </p>
        </div>

        {/* Name Picker Placeholder */}
        <div className="p-5 rounded-2xl glass-panel space-y-3">
          <span className="text-xs font-medium text-slate-500">Who are you?</span>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              Select Member...
            </span>
          </div>
        </div>

        {/* Checklist items placeholder */}
        <div className="p-6 rounded-2xl glass-panel space-y-4">
          <span className="text-xs font-medium text-slate-500">Tasks</span>
          <div className="space-y-3">
            {[1, 2, 3].map((num) => (
              <div
                key={num}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800"
              >
                <div className="w-5 h-5 rounded-md border-2 border-slate-300 dark:border-slate-700" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Task item #{num}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
