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
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

import { ShareSheet } from "./ShareSheet";

export interface TaskListCardProps {
  id: string;
  token: string;
  title: string;
  groupName: string;
  listDate: string;
  dueAt?: string | null;
  status: "active" | "readonly" | "expired";
  totalItems: number;
  completedItems: number;
  shareUrl?: string;
  onDelete?: (id: string) => void;
}

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
  shareUrl,
  onDelete,
}: TaskListCardProps) {
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const percentage =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const statusVariant = {
    active: "done",
    readonly: "pending",
    expired: "neutral",
  }[status] as "done" | "pending" | "neutral";

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/t/${token}`
      : `/t/${token}`;

  const copyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Member link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowShareSheet(true);
  };

  return (
    <>
      <Card className="p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {groupName}
            </span>
            <Badge variant={statusVariant} className="text-[10px] uppercase">
              {status}
            </Badge>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
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
                <div className="absolute right-0 mt-1 w-36 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-30 py-1 text-xs">
                  <Link
                    href={`/admin/tasks/${id}`}
                    className="flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit List
                  </Link>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
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
                      className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-left"
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
          <h3 className="text-base font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors line-clamp-1 mb-2">
            {title}
          </h3>
        </Link>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mb-4">
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

      <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <ProgressBar value={percentage} showLabel={true} size="sm" />

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs py-1.5"
            onClick={copyLink}
          >
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </Button>

          <Button
            size="sm"
            variant="primary"
            className="flex-1 text-xs py-1.5 bg-[#25D366] hover:bg-[#20ba5a] text-white"
            onClick={handleShare}
          >
            <Share2 className="w-3.5 h-3.5" /> Share WA
          </Button>
        </div>
      </div>
    </Card>

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
      }}
    />
    </>
  );
}
