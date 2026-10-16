import Link from "next/link";
import { MessageSquare, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--color-canvas)]">
      <div className="w-full max-w-sm p-8 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-primary)] shadow-md text-center space-y-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] mb-1">
          <MessageSquare className="w-7 h-7" />
        </div>
        
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
            TaskTracker
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Friction-free daily task management and dispatch for WhatsApp groups.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-3">
          <Link
            href="/login"
            className="w-full py-2.5 px-4 rounded-lg font-medium text-sm text-[var(--color-text-inverse)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <span>Professor Login</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-[11px] text-[var(--color-text-tertiary)] leading-relaxed">
            Students open checklists directly via shared WhatsApp links — no login required.
          </p>
        </div>
      </div>
    </main>
  );
}
