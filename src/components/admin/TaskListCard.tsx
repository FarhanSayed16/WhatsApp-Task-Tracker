"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatDate } from "@/lib/utils";
import {
  Share2,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  MoreVertical,
  Trash2,
  Edit,
  Repeat,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { ShareSheet } from "./ShareSheet";
import { WhatsAppIcon } from "@/components/icons/WhatsApp";

export type TaskListCardStatus =
  | "draft"
  | "active"
  | "completed"
  | "archived";

export interface TaskListCardProps {
  id: string;
  token: string;
  title: string;
  groupName: string;
  listDate: string;
  dueAt?: string | null;
  status: TaskListCardStatus | string;
  totalItems: number;
  completedItems: number;
  shareUrl?: string;
  recurrence?: {
    freq?: string;
    days?: number[];
    end_date?: string;
    auto_generated?: boolean;
    source?: string;
  } | null;
  onDelete?: (id: string) => void;
  /** Single-row layout for dense dashboards */
  compact?: boolean;
}

const STATUS_BADGE: Record<
  string,
  { variant: "draft" | "active" | "verified" | "neutral" | "pending"; label: string }
> = {
  draft: { variant: "draft", label: "Draft" },
  active: { variant: "active", label: "Active" },
  completed: { variant: "verified", label: "Completed" },
  archived: { variant: "neutral", label: "Archived" },
};

export function TaskListCard({
  id,
  token,
  title,
  groupName,
  listDate,
  dueAt,
  status,
  totalItems,
  completedItems,
  recurrence,
  onDelete,
  compact = false,
}: TaskListCardProps) {
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareItems, setShareItems] = useState<
    Array<{ id: string; text: string; status: string; assigned_member_id?: string | null }>
  >([]);
  const [shareMembers, setShareMembers] = useState<
    Array<{ id: string; name: string; phone?: string | null; active: boolean }>
  >([]);
  const [shareMeta, setShareMeta] = useState<{
    member_link?: string;
  }>({});

  const percentage =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const badge = STATUS_BADGE[status] || {
    variant: "neutral" as const,
    label: String(status),
  };

  const publicPath = `/t/${token}`;

  const copyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`);
      toast.success("Member link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShareLoading(true);
    try {
      const res = await fetch(`/api/admin/task-lists/${id}`);
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json?.error?.message || "Failed to load task list");
      }
      const data = json.data;
      setShareItems(data.items || []);
      setShareMembers(data.members || []);
      setShareMeta({
        member_link: data.task_list?.member_link || `${window.location.origin}${publicPath}`,
      });
      setShowShareSheet(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to open share sheet";
      toast.error(message);
    } finally {
      setShareLoading(false);
    }
  };

  const shareSheet = (
      <ShareSheet
        isOpen={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        taskList={{
          id,
          token,
          title,
          group_name: groupName,
          list_date: listDate,
          due_at: dueAt,
          total_items: totalItems,
          completed_items: completedItems,
          member_link: shareMeta.member_link || publicPath,
        }}
        items={shareItems}
        members={shareMembers}
      />
  );

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--color-surface-sunken)]/60 transition-colors">
          <Link href={`/admin/tasks/${id}`} className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate hover:text-[var(--color-primary)]">
              {title}
            </p>
            <p className="text-[11px] text-[var(--color-text-tertiary)] truncate mt-0.5">
              {groupName} · {formatDate(listDate)} · {completedItems}/{totalItems}
            </p>
          </Link>
          <div className="w-16 shrink-0 hidden sm:block">
            <ProgressBar value={percentage} size="sm" showLabel={false} />
          </div>
          <span className="text-[11px] font-bold text-[var(--color-text-secondary)] w-8 text-right tabular-nums">
            {percentage}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-[11px] hidden sm:inline-flex"
            onClick={copyLink}
          >
            Copy
          </Button>
          <Button
            size="sm"
            variant="whatsapp"
            className="h-8 px-2.5 text-[11px]"
            onClick={handleShare}
            disabled={shareLoading}
          >
            <WhatsAppIcon className="w-3.5 h-3.5" />
            {shareLoading ? "…" : "WA"}
          </Button>
        </div>
        {shareSheet}
      </>
    );
  }

  return (
    <>
      <Card className="p-5 flex flex-col justify-between hover:border-[var(--color-primary)]/30 hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all">
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]">
                {groupName}
              </span>
              <Badge variant={badge.variant} showGlyph className="text-[10px]">
                {badge.label}
              </Badge>
              {recurrence?.auto_generated && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-info)]/20">
                  Auto
                </span>
              )}
              {recurrence?.freq && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] border border-[var(--color-primary)]/20 flex items-center gap-1">
                  <Repeat className="w-2.5 h-2.5" />
                  {recurrence.freq}
                </span>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] rounded"
                aria-label="Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-1 w-36 rounded-[var(--radius-md)] glass-panel z-30 py-1 text-xs">
                    <Link
                      href={`/admin/tasks/${id}`}
                      className="flex items-center gap-2 px-3 py-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit List
                    </Link>
                    <Link
                      href={`/admin/tasks/new?clone_from=${id}`}
                      className="flex items-center gap-2 px-3 py-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Copy className="w-3.5 h-3.5" /> Duplicate
                    </Link>
                    <a
                      href={publicPath}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]"
                      onClick={() => setMenuOpen(false)}
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> View Public
                    </a>
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete(id);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] text-left"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <Link href={`/admin/tasks/${id}`}>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors line-clamp-1 mb-2">
              {title}
            </h3>
          </Link>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-tertiary)] mb-4">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(listDate)}
            </span>
            {dueAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Due: {formatDate(dueAt)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {completedItems}/{totalItems} items
            </span>
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-[var(--color-border-secondary)]">
          <ProgressBar value={percentage} showLabel={true} size="sm" />

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 text-xs"
              onClick={copyLink}
            >
              <Copy className="w-3.5 h-3.5" /> Copy Link
            </Button>

            <Button
              size="sm"
              variant="whatsapp"
              className="flex-1 text-xs"
              onClick={handleShare}
              disabled={shareLoading}
            >
              <WhatsAppIcon className="w-3.5 h-3.5 mr-1" />{" "}
              {shareLoading ? "Loading…" : "Share WA"}
            </Button>
          </div>
        </div>
      </Card>

      {shareSheet}
    </>
  );
}
