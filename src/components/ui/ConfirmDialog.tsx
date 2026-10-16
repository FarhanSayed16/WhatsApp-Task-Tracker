"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, Info } from "lucide-react";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  loading = false,
}: ConfirmDialogProps) {
  const isDanger = variant === "danger";

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      size="sm"
      showCloseButton={!loading}
    >
      <div className="flex flex-col items-center text-center pt-2 pb-2">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
            isDanger
              ? "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
              : "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
          }`}
        >
          {isDanger ? (
            <AlertTriangle className="w-6 h-6" />
          ) : (
            <Info className="w-6 h-6" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          {title}
        </h3>
        <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-6">
          {message}
        </div>
        <div className="flex items-center gap-3 w-full">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            disabled={loading}
            onClick={onClose}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={isDanger ? "danger" : "primary"}
            className="flex-1"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
