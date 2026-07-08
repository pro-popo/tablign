import { useEffect, useState } from "react";
import { theme } from "./theme";
import { Button } from "./Button";
import type { SpaceOption } from "./CollectionMoreMenu";

export interface ImportCodeInfo { title: string; icon: string | null; link_count: number; shared_by: string | null }

export interface ImportCodeDialogProps {
  open: boolean;
  spaces: SpaceOption[];
  onLookup: (code: string) => Promise<ImportCodeInfo>;
  onImport: (code: string, spaceId: string) => Promise<void>;
  onClose: () => void;
}

/** 공유 코드 입력 → 미리보기 → 대상 스페이스 선택 → 가져오기 다이얼로그. */
export function ImportCodeDialog({ open, spaces, onLookup, onImport, onClose }: ImportCodeDialogProps) {
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<ImportCodeInfo | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 닫힐 때 상태 초기화
  useEffect(() => {
    if (!open) { setCode(""); setInfo(null); setSpaceId(null); setError(null); setBusy(false); }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const normalized = code.trim().toUpperCase();

  async function lookup() {
    setError(null); setBusy(true);
    try {
      setInfo(await onLookup(normalized));
    } catch {
      setInfo(null);
      setError("찾을 수 없거나 만료된 코드예요.");
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    if (!spaceId) return;
    setBusy(true);
    try {
      await onImport(normalized, spaceId);
      onClose();
    } catch {
      setError("가져오지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return (
    <div role="presentation" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <div role="dialog" aria-modal="true" aria-label="코드로 가져오기" onClick={(e) => e.stopPropagation()}
        style={{ width: 340, maxWidth: "calc(100vw - 32px)", background: theme.surface, borderRadius: 12, padding: "20px 20px 16px", boxShadow: "0 12px 40px rgba(0,0,0,.22)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>코드로 가져오기</div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="공유 코드 8자리"
            maxLength={8}
            style={{ flex: 1, padding: "8px 10px", border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", outline: "none", boxSizing: "border-box" }}
          />
          <Button onClick={lookup} disabled={busy || normalized.length !== 8}>조회</Button>
        </div>
        {error && <p style={{ marginTop: 8, fontSize: 12.5, color: theme.danger }}>{error}</p>}
        {info && (
          <>
            <div style={{ marginTop: 12, padding: "10px 12px", background: theme.surface2, borderRadius: 9 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: theme.text }}>
                {info.icon ? `${info.icon} ` : ""}{info.title}
              </div>
              <div style={{ marginTop: 3, fontSize: 12, color: theme.textMuted }}>
                링크 {info.link_count}개{info.shared_by ? ` · ${info.shared_by}님이 공유` : ""}
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: theme.textFaint }}>가져올 스페이스</div>
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {spaces.map((s) => (
                <button key={s.id} type="button" onClick={() => setSpaceId(s.id)}
                  style={{
                    border: `1px solid ${spaceId === s.id ? theme.accent : theme.border}`,
                    background: spaceId === s.id ? theme.accentWeak : theme.surface,
                    color: spaceId === s.id ? theme.accent : theme.text,
                    borderRadius: 8, padding: "5px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  }}>
                  {s.icon ? `${s.icon} ` : ""}{s.name}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button variant="outline" onClick={onClose}>취소</Button>
              <Button onClick={doImport} disabled={busy || !spaceId}>가져오기</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
