"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSWRFetch } from "@/hooks/useSWRFetch";
import { useToast } from "@/components/ui/Toast";
import type { Template } from "@/types";
import {
  FileText,
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
  ArrowRight,
  Copy,
  CheckCircle2,
  Clock,
  Sparkles,
  ListPlus,
  Send,
  Repeat,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function TemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"checklist" | "message">("checklist");

  // Fetch templates
  const {
    data: templatesData,
    isLoading,
    mutate,
  } = useSWRFetch<Template[]>("/api/admin/templates");

  const templates = Array.isArray(templatesData) ? templatesData : [];
  const checklistTemplates = templates.filter((t) => t.type === "checklist");
  const messageTemplates = templates.filter((t) => t.type === "message");

  // Recurring schedules (parent lists with freq, not auto-generated children)
  const {
    data: listsData,
    isLoading: listsLoading,
    mutate: mutateLists,
  } = useSWRFetch<any>("/api/admin/task-lists?limit=100");
  const allLists = Array.isArray(listsData)
    ? listsData
    : listsData?.data || [];
  const recurringLists = allLists.filter((l: any) => {
    const rec = l.recurrence;
    return rec && typeof rec === "object" && rec.freq && !rec.auto_generated;
  });
  const [stoppingId, setStoppingId] = useState<string | null>(null);

  const handleStopRecurrence = async (listId: string) => {
    try {
      setStoppingId(listId);
      const res = await fetch(`/api/admin/task-lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurrence: null }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json?.error?.message || "Failed to stop recurrence");
      }
      toast.success("Recurrence stopped");
      mutateLists();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to stop recurrence");
    } finally {
      setStoppingId(null);
    }
  };

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState<"checklist" | "message">("checklist");
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [newItemText, setNewItemText] = useState("");
  const [messageText, setMessageText] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const openCreateModal = (type: "checklist" | "message") => {
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateType(type);
    setChecklistItems([]);
    setNewItemText("");
    setMessageText(
      type === "message"
        ? "📋 *{title}*\n👥 {group} | 📅 {date}\n\n{items}\n\n👉 *Tick done here:* {link}"
        : ""
    );
    setModalOpen(true);
  };

  const openEditModal = (t: Template) => {
    setEditingTemplate(t);
    setTemplateName(t.name);
    setTemplateType(t.type);
    if (t.type === "checklist") {
      setChecklistItems(t.body?.items || []);
    } else {
      setMessageText(t.body?.text || "");
    }
    setModalOpen(true);
  };

  const handleAddChecklistItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = newItemText.trim();
    if (!text) return;
    setChecklistItems([...checklistItems, text]);
    setNewItemText("");
  };

  const handleRemoveChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const insertPlaceholder = (ph: string) => {
    setMessageText((prev) => `${prev} {${ph}} `);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    if (templateType === "checklist" && checklistItems.length === 0) {
      toast.error("Please add at least one item to the checklist template");
      return;
    }

    if (templateType === "message" && !messageText.trim()) {
      toast.error("Please enter the message template text");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: templateName.trim(),
        type: templateType,
        body:
          templateType === "checklist"
            ? { items: checklistItems }
            : {
                text: messageText,
                placeholders: ["title", "group", "date", "due", "items", "link"],
              },
      };

      const url = editingTemplate
        ? `/api/admin/templates/${editingTemplate.id}`
        : "/api/admin/templates";
      const method = editingTemplate ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data?.error?.message || "Failed to save template");
      }

      toast.success(
        editingTemplate ? "Template updated successfully" : "Template created successfully"
      );
      setModalOpen(false);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/admin/templates/${deletingTemplate.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete template");

      toast.success("Template deleted");
      setDeletingTemplate(null);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete template");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <AdminLayout
      title="Checklist & Message Templates"
      subtitle="Create reusable checklists and WhatsApp dispatch formats"
      actions={
        <Button
          size="sm"
          variant="primary"
          onClick={() => openCreateModal(activeTab)}
          className="gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New {activeTab === "checklist" ? "Checklist" : "Message"} Template</span>
        </Button>
      }
    >
      <div className="space-y-6 pb-12">
        {/* Active Recurring Schedules */}
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Active Recurring Schedules
            </h2>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
              {recurringLists.length}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Parent lists that auto-create drafts on schedule. Stop recurrence anytime without deleting the list.
          </p>
          {listsLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : recurringLists.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">
              No active schedules. Enable recurrence when creating a task list.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recurringLists.map((l: any) => {
                const rec = l.recurrence || {};
                const freqLabel =
                  rec.freq === "custom"
                    ? `Every ${rec.interval_days || "?"} day(s)`
                    : rec.freq === "weekly"
                    ? `Weekly${Array.isArray(rec.days) ? ` (${rec.days.length}d)` : ""}`
                    : "Daily";
                return (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/admin/tasks/${l.id}`}
                        className="font-semibold text-slate-800 dark:text-slate-200 hover:text-emerald-600 truncate block"
                      >
                        {l.title}
                      </Link>
                      <span className="text-slate-500">
                        {l.group_name || "Group"} · {freqLabel}
                        {rec.end_date ? ` · ends ${formatDate(rec.end_date)}` : ""}
                        {" · since "}
                        {formatDate(l.list_date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/admin/tasks/${l.id}`}>
                        <Button size="sm" variant="ghost" className="text-xs h-7">
                          Open
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 text-rose-600 border-rose-200 hover:bg-rose-50"
                        disabled={stoppingId === l.id}
                        onClick={() => handleStopRecurrence(l.id)}
                      >
                        {stoppingId === l.id ? "Stopping…" : "Stop"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Tab Controls */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <Tabs
            tabs={[
              {
                id: "checklist",
                label: `Checklists (${checklistTemplates.length})`,
              },
              {
                id: "message",
                label: `WhatsApp Formats (${messageTemplates.length})`,
              },
            ]}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab as any)}
          />
        </div>

        {/* Tab Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ) : activeTab === "checklist" ? (
          checklistTemplates.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-10 h-10 text-slate-400" />}
              title="No checklist templates yet"
              description="Create a recurring checklist template (e.g. Lab Session, Assignment Submission, Exam Prep) to spin up checklists in one tap."
              actionNode={
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => openCreateModal("checklist")}
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Create Checklist Template
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {checklistTemplates.map((t) => {
                const itemsCount = t.body?.items?.length || 0;
                return (
                  <div
                    key={t.id}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant="verified" className="text-[10px]">
                          Checklist
                        </Badge>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(t)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTemplate(t)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2 line-clamp-1">
                        {t.name}
                      </h3>

                      <div className="space-y-1 mb-4">
                        {(t.body?.items || []).slice(0, 3).map((item, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 truncate"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="truncate">{item}</span>
                          </div>
                        ))}
                        {itemsCount > 3 && (
                          <p className="text-[11px] text-slate-400 pl-3">
                            +{itemsCount - 3} more items
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500 font-medium">
                        {itemsCount} {itemsCount === 1 ? "task" : "tasks"}
                      </span>

                      <Link
                        href={`/admin/tasks/new?template_id=${t.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-all"
                      >
                        Use Template <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : messageTemplates.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="w-10 h-10 text-slate-400" />}
            title="No WhatsApp message formats yet"
            description="Customize the message structure dispatched to your WhatsApp groups."
            actionNode={
              <Button
                size="sm"
                variant="primary"
                onClick={() => openCreateModal("message")}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Create Message Format
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {messageTemplates.map((t) => (
              <div
                key={t.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-500/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge variant="neutral" className="text-[10px]">
                      WhatsApp Format
                    </Badge>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(t)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingTemplate(t)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2">
                    {t.name}
                  </h3>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap line-clamp-5 mb-4 border border-slate-200/50 dark:border-slate-700/50">
                    {t.body?.text || ""}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span>Variables: title, group, date, due, link</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs py-1"
                    onClick={() => {
                      navigator.clipboard.writeText(t.body?.text || "");
                      toast.success("Template text copied to clipboard");
                    }}
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copy Format
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Template Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingTemplate
            ? `Edit ${editingTemplate.type === "checklist" ? "Checklist" : "Message"} Template`
            : `Create ${templateType === "checklist" ? "Checklist" : "Message"} Template`
        }
      >
        <form onSubmit={handleSaveTemplate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Template Name
            </label>
            <Input
              type="text"
              placeholder={
                templateType === "checklist"
                  ? "e.g. Lab Experiment Verification"
                  : "e.g. Weekly Urgent Deadline Format"
              }
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              required
            />
          </div>

          {templateType === "checklist" ? (
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Checklist Items ({checklistItems.length})
              </label>

              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Add a checklist task item..."
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddChecklistItem();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => handleAddChecklistItem()}
                  disabled={!newItemText.trim()}
                >
                  Add
                </Button>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1.5 pt-2">
                {checklistItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs gap-2"
                  >
                    <span className="text-slate-800 dark:text-slate-200 truncate">
                      {idx + 1}. {item}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveChecklistItem(idx)}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Message Format
                </label>
                <span className="text-[11px] text-slate-400">WhatsApp markdown supported</span>
              </div>

              {/* Placeholder helper chips */}
              <div className="flex flex-wrap items-center gap-1.5 pb-1">
                {["title", "group", "date", "due", "items", "link"].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder(ph)}
                    className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    +{ph}
                  </button>
                ))}
              </div>

              <textarea
                rows={6}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Compose your WhatsApp dispatch template format..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving..." : editingTemplate ? "Update Template" : "Create Template"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingTemplate}
        onClose={() => setDeletingTemplate(null)}
        onConfirm={handleDeleteTemplate}
        title="Delete Template"
        message={`Are you sure you want to permanently delete "${deletingTemplate?.name}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleteLoading}
      />
    </AdminLayout>
  );
}
