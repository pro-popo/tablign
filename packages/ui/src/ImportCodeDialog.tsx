import { useEffect, useState } from "react";
import { theme } from "./theme";
import { overlayAnimationCss, overlayIn, panelIn } from "./overlayAnimation";
import { Button } from "./Button";
import type { SpaceOption } from "./CollectionMoreMenu";

export interface ImportCodeInfo { title: string; icon: string | null; link_count: number; shared_by: string | null }

export interface ImportCodeDialogProps {
  open: boolean;
  spaces: SpaceOption[];
  /** 기본 선택할 스페이스. 헤더에서 들어오면 목적지가 자명하므로 현재 스페이스를 넘긴다. */
  defaultSpaceId?: string | null;
  onLookup: (code: string) => Promise<ImportCodeInfo>;
  /** 조회 결과를 함께 넘긴다 — 호출부가 제목·링크 수로 골격을 먼저 그릴 수 있다. */
  onImport: (code: string, spaceId: string, info: ImportCodeInfo) => Promise<void>;
  onClose: () => void;
}

/** 확정 버튼 안 스피너. accent 채움 위라 흰색.
 *  컴포넌트 밖에 둬야 리렌더마다 재마운트되며 회전이 처음으로 되돌아가지 않는다. */
function Spinner() {
  return (
    <>
      <style>{spinCss}</style>
      <span aria-hidden="true" style={{
        boxSizing: "border-box", width: 13, height: 13, borderRadius: "50%", flex: "none",
        border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff",
        animation: "tablign-import-spin .7s linear infinite",
      }} />
    </>
  );
}

/** 공유 코드 입력 → 미리보기 → 대상 스페이스 선택 → 가져오기 다이얼로그. */
export function ImportCodeDialog({ open, spaces, defaultSpaceId = null, onLookup, onImport, onClose }: ImportCodeDialogProps) {
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<ImportCodeInfo | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 열릴 때 목적지를 미리 골라 두고, 닫힐 때 상태 초기화.
  // 기본 선택이 없으면 조회 후 스페이스를 한 번 더 클릭해야 '추가'가 활성된다.
  useEffect(() => {
    if (open) {
      setSpaceId(defaultSpaceId && spaces.some((s) => s.id === defaultSpaceId) ? defaultSpaceId : null);
    } else {
      setCode(""); setInfo(null); setSpaceId(null); setError(null); setBusy(false);
    }
  }, [open, defaultSpaceId, spaces]);
  useEffect(() => {
    if (!open) return;
    // 진행 중 Escape도 무시 — 저장이 돌고 있는데 화면만 사라진다
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !busy) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, busy]);

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
    if (!spaceId || !info || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onImport(normalized, spaceId, info);
      onClose();
    } catch {
      setError("가져오지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return (
    // 진행 중에는 바깥 클릭으로 닫지 않는다 — 저장이 돌고 있는데 화면만 사라진다
    <div role="presentation" onClick={() => { if (!busy) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", animation: overlayIn, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <style>{overlayAnimationCss}</style>
      <div role="dialog" aria-modal="true" aria-label="공유 코드로 추가" onClick={(e) => e.stopPropagation()}
        style={{ width: 340, maxWidth: "calc(100vw - 32px)", animation: panelIn, background: theme.surface, borderRadius: 12, padding: "20px 20px 16px", boxShadow: "0 12px 40px rgba(0,0,0,.22)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>공유 코드로 추가</div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="공유 코드 8자리"
            maxLength={8}
            disabled={busy}
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
            <div style={{ marginTop: 10, fontSize: 12, color: theme.textFaint }}>어디에 추가할까요</div>
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {spaces.map((s) => (
                <button key={s.id} type="button" onClick={() => setSpaceId(s.id)} disabled={busy}
                  style={{
                    opacity: busy ? 0.5 : 1,
                    border: `1px solid ${spaceId === s.id ? theme.accent : theme.border}`,
                    background: spaceId === s.id ? theme.accentWeak : theme.surface,
                    color: spaceId === s.id ? theme.accent : theme.text,
                    borderRadius: 8, padding: "5px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  }}>
                  {s.icon ? `${s.icon} ` : ""}{s.name}
                </button>
              ))}
            </div>
            {/* 스냅샷임을 미리 알린다 — 초대(실시간 협업)와 헷갈리면 안 된다 */}
            <p style={{ marginTop: 11, fontSize: 11.5, color: theme.textFaint, lineHeight: 1.5 }}>
              복사본으로 추가돼요. 원본이 바뀌어도 반영되지 않습니다.
            </p>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button variant="outline" onClick={onClose} disabled={busy}>취소</Button>
              <Button onClick={doImport} disabled={busy || !spaceId} aria-busy={busy || undefined}>
                {busy ? <><Spinner />추가 중…</> : "추가"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const spinCss = `
@keyframes tablign-import-spin { to { transform: rotate(360deg) } }
@media (prefers-reduced-motion: reduce) {
  [style*="tablign-import-spin"] { animation-duration: 2.4s }
}
`;
