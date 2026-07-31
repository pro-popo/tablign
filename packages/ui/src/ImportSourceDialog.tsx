import { useEffect, useRef, useState } from "react";
import { theme } from "./theme";
import { overlayAnimationCss, overlayIn, panelIn } from "./overlayAnimation";

export interface ImportSourceDialogProps {
  open: boolean;
  /** Chrome 북마크를 골랐을 때 */
  onBookmarks: () => void;
  /** Toby 내보내기 파일을 골랐을 때 — 파일의 텍스트를 넘긴다(파싱은 호출자 몫) */
  onTobyFile: (text: string) => void;
  onClose: () => void;
}

/** 가져오기 소스 선택 — 미리보기 다이얼로그(ImportBookmarksDialog) 앞에 끼우는 한 장. */
export function ImportSourceDialog({ open, onBookmarks, onTobyFile, onClose }: ImportSourceDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReading(false);
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function onFilePicked(file: File | undefined) {
    if (!file) return;
    setReading(true);
    try {
      // File.text()는 jsdom에 없다 — FileReader는 브라우저·테스트 양쪽에서 동작한다
      const text = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result ?? ""));
        r.onerror = () => reject(r.error);
        r.readAsText(file);
      });
      onTobyFile(text);
    } finally {
      setReading(false);
      // 같은 파일을 다시 골라도 change가 뜨도록 초기화
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const option: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
    padding: "12px 13px", border: `1px solid ${theme.border}`, borderRadius: 11,
    background: theme.surface, cursor: "pointer", fontFamily: "inherit", boxSizing: "border-box",
  };
  const iconBox: React.CSSProperties = {
    width: 34, height: 34, borderRadius: 9, flex: "none", display: "flex",
    alignItems: "center", justifyContent: "center", background: theme.accentWeak,
    color: theme.accent, fontSize: 16,
  };

  return (
    <div role="presentation" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", animation: overlayIn,
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <style>{overlayAnimationCss}</style>
      <div role="dialog" aria-modal="true" aria-label="가져오기" onClick={(e) => e.stopPropagation()}
        style={{ boxSizing: "border-box", width: 340, maxWidth: "calc(100vw - 32px)", animation: panelIn,
          background: theme.surface, borderRadius: 14, padding: "20px 18px 16px",
          boxShadow: "0 18px 50px rgba(0,0,0,.26)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>가져오기</div>
        <div style={{ marginTop: 4, fontSize: 12.5, color: theme.textMuted }}>어디서 가져올까요?</div>

        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" style={option} onClick={onBookmarks}>
            <span aria-hidden style={iconBox}>★</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: theme.text }}>Chrome 북마크</span>
              <span style={{ display: "block", marginTop: 2, fontSize: 12, color: theme.textMuted }}>
                북마크바의 폴더를 그대로 옮겨요
              </span>
            </span>
          </button>

          <button type="button" style={option} disabled={reading}
            onClick={() => fileRef.current?.click()}>
            <span aria-hidden style={iconBox}>⬒</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: theme.text }}>Toby</span>
              <span style={{ display: "block", marginTop: 2, fontSize: 12, color: theme.textMuted }}>
                Toby에서 내보낸 JSON 파일을 골라주세요
              </span>
            </span>
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" data-testid="toby-file-input"
            style={{ display: "none" }} onChange={(e) => onFilePicked(e.target.files?.[0])} />
        </div>
      </div>
    </div>
  );
}
