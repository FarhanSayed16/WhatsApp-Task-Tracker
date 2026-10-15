import Link from "next/link";

export default function TemplatesPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Templates</h1>
          <p className="text-sm text-slate-500">Reusable checklist and WhatsApp message templates</p>
        </div>
      </div>

      <div className="p-12 text-center rounded-2xl glass-panel text-slate-500">
        Templates feature (Phase 12).
      </div>
    </div>
  );
}
