import { useEffect } from "react";
import { theme } from "./theme";
import { overlayAnimationCss, overlayIn, panelIn } from "./overlayAnimation";
import { Button } from "./Button";

export interface ShareCodeDialogProps {
  open: boolean;
  collectionTitle: string;
  /** null이면 만료 선택 화면, 값이 있으면 코드 표시 화면 */
  issued: { code: string; expires_at: string | null } | null;
  onIssue: (expiresInDays: number | null) => void;
  onRevoke: () => void;
  /** 코드가 클립보드에 복사됐을 때 호출(토스트 표시용) */
  onCopied?: () => void;
  onClose: () => void;
}

/** 컬렉션 공유 코드 발급·표시 다이얼로그. */
export function ShareCodeDialog({ open, collectionTitle, issued, onIssue, onRevoke, onClose, onCopied }: ShareCodeDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div role="presentation" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", animation: overlayIn, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <style>{overlayAnimationCss}</style>
      <div role="dialog" aria-modal="true" aria-label="컬렉션 공유 코드" onClick={(e) => e.stopPropagation()}
        style={{ width: 340, maxWidth: "calc(100vw - 32px)", animation: panelIn, background: theme.surface, borderRadius: 12, padding: "20px 20px 16px", boxShadow: "0 12px 40px rgba(0,0,0,.22)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>'{collectionTitle}' 공유 코드</div>
        {issued === null ? (
          <>
            <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: theme.textMuted }}>
              코드를 받은 사람은 이 컬렉션을 자기 스페이스로 복사해 갈 수 있어요.
            </p>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button variant="outline" onClick={() => onIssue(null)}>무기한 코드 만들기</Button>
              <Button onClick={() => onIssue(7)}>7일 코드 만들기</Button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <code style={{ flex: 1, textAlign: "center", fontSize: 22, fontWeight: 800, letterSpacing: "0.18em", padding: "10px 0", background: theme.surface2, borderRadius: 9, color: theme.text }}>
                {issued.code}
              </code>
              <Button onClick={() => navigator.clipboard?.writeText(issued.code).then(() => onCopied?.()).catch(() => {})}>복사</Button>
            </div>
            <p style={{ marginTop: 8, fontSize: 12, color: theme.textFaint }}>
              {issued.expires_at
                ? `${new Date(issued.expires_at).toLocaleDateString()}까지 사용할 수 있어요.`
                : "무기한 코드예요. 더 이상 공유하지 않으려면 회수하세요."}
            </p>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between" }}>
              <Button variant="outline" style={{ color: theme.danger }} onClick={onRevoke}>회수</Button>
              <Button variant="outline" onClick={onClose}>닫기</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
