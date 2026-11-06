import { useEffect, type ReactNode } from "react";
import { theme } from "./theme";
import { useT } from "./i18n";
import { overlayAnimationCss, overlayIn, panelIn } from "./overlayAnimation";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  /** null이면 취소 버튼 없이 확인 하나짜리 얼럿이 된다 */
  cancelLabel?: string | null;
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
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    // 다른 다이얼로그 위에 뜨기도 하므로 캡처 단계에서 먼저 받고 멈춘다 —
    // 그러지 않으면 Escape가 뒤에 깔린 창까지 함께 닫는다.
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" && e.key !== "Enter") return;
      e.stopPropagation();
      if (e.key === "Escape") onCancel(); else onConfirm();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", animation: overlayIn, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
    >
      <style>{overlayAnimationCss}</style>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ width: 320, maxWidth: "calc(100vw - 32px)", animation: panelIn, background: theme.surface, borderRadius: 12, padding: "20px 20px 16px", boxShadow: "0 12px 40px rgba(0,0,0,.22)" }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{title}</div>
        {message && (
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: theme.textMuted }}>{message}</div>
        )}
        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {cancelLabel !== null && <Button variant="outline" onClick={onCancel}>{cancelLabel ?? t.common.cancel}</Button>}
          <Button
            onClick={onConfirm}
            autoFocus
            style={danger ? { background: theme.danger } : undefined}
          >
            {confirmLabel ?? t.common.confirm}
          </Button>
        </div>
      </div>
    </div>
  );
}
