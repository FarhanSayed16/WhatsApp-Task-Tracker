import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md p-8 rounded-2xl glass-panel shadow-xl shadow-slate-200/50 dark:shadow-none text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-3xl font-bold mb-2">
          📋
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            WhatsApp Task Tracker
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Lightweight, friction-free task management for WhatsApp groups.
          </p>
        </div>

        <div className="pt-4 flex flex-col gap-3">
          <Link
            href="/login"
            className="w-full py-3 px-4 rounded-xl font-medium text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all duration-150 shadow-md shadow-emerald-600/20"
          >
            Admin PIN Login
          </Link>
          <div className="text-xs text-slate-400 dark:text-slate-500">
            Group members access their checklists directly via WhatsApp links.
          </div>
        </div>
      </div>
    </main>
  );
}
