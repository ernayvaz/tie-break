"use client";

import * as React from "react";
import { Button } from "./button";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
  variant?: "primary" | "danger";
  loading?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "primary",
  loading = false,
}: ModalProps) {
  const [busy, setBusy] = React.useState(false);
  const isBusy = loading || busy;

  React.useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  const handleConfirm = React.useCallback(async () => {
    if (!onConfirm) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }, [onConfirm]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isBusy) onClose();
  };

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isBusy) onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose, isBusy]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-nord-polar/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="w-full max-w-md rounded-lg border border-nord-polarLighter/50 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-nord-polarLighter/50 px-4 py-3">
          <h2 id="modal-title" className="text-lg font-semibold text-nord-polar">
            {title}
          </h2>
        </div>
        <div className="px-4 py-4 text-nord-polarLight text-sm">
          {children}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-nord-polarLighter/50 px-4 py-3 sm:flex sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isBusy}
            className="w-full sm:w-auto"
          >
            {cancelLabel}
          </Button>
          {onConfirm && (
            <Button
              type="button"
              variant={variant}
              onClick={handleConfirm}
              disabled={isBusy}
              className="w-full sm:w-auto"
            >
              {isBusy ? "…" : confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
