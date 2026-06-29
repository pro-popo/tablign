import { useEffect, type ReactNode } from "react";
import { theme } from "./theme";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true면 확인 버튼을 위험(빨강) 스타일로 표시한다. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 되돌릴 수 없는 동작(삭제 등) 전에 사용자 확인을 받는 모달.
 *  배경 클릭·ESC로 취소, Enter로 확인할 수 있다. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ width: 320, maxWidth: "calc(100vw - 32px)", background: theme.surface, borderRadius: 12, padding: "20px 20px 16px", boxShadow: "0 12px 40px rgba(0,0,0,.22)" }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{title}</div>
        {message && (
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: theme.textMuted }}>{message}</div>
        )}
        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button
            onClick={onConfirm}
            autoFocus
            style={danger ? { background: theme.danger } : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
