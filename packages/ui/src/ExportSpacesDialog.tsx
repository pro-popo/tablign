import { useEffect, useState } from "react";
import { theme } from "./theme";
import { overlayAnimationCss, overlayIn, panelIn } from "./overlayAnimation";
import { TriCheckbox, triCheckboxCss } from "./TriCheckbox";
import { SpaceIcon } from "./SpaceIcon";
import { Button } from "./Button";

const exportCss = `
.tbl-exp-row { background: none; transition: background .12s ease }
.tbl-exp-row:hover { background: ${theme.surface2} }
`;

export interface ExportSpaceOption {
  id: string;
  name: string;
  icon: string | null;
  /** 나에게 공유된 스페이스 — 목록 아래 "공유 스페이스"로 따로 묶는다 */
  shared?: boolean;
}

export interface ExportSpacesDialogProps {
  open: boolean;
  spaces: ExportSpaceOption[];
  /** 고른 스페이스 id(목록 순서). 실패하면 throw — 다이얼로그가 안내하고 다시 누를 수 있게 둔다. */
  onExport: (spaceIds: string[]) => Promise<void>;
  onClose: () => void;
}

/** 내보낼 스페이스를 체크해 고르는 다이얼로그. 열 때마다 전체 선택으로 시작한다. */
export function ExportSpacesDialog({ open, spaces, onExport, onClose }: ExportSpacesDialogProps) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPicked(new Set(spaces.map((s) => s.id)));
    setBusy(false);
    setError(null);
    // spaces는 열 때의 목록으로 충분하다 — 열린 채 바뀌어 선택이 초기화되면 안 된다
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !busy) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const total = spaces.length;
  const n = spaces.filter((s) => picked.has(s.id)).length;
  const mine = spaces.filter((s) => !s.shared);
  const shared = spaces.filter((s) => s.shared);

  function toggleAll() {
    setPicked(n === total ? new Set() : new Set(spaces.map((s) => s.id)));
  }
  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onExport(spaces.filter((s) => picked.has(s.id)).map((s) => s.id));
    } catch {
      setError("내보내지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  const row = (s: ExportSpaceOption) => {
    const on = picked.has(s.id);
    return (
      <div key={s.id} className="tbl-exp-row" onClick={() => toggle(s.id)}
        style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 10px", borderRadius: 8,
          cursor: "pointer", userSelect: "none", color: theme.textSub }}>
        <TriCheckbox state={on ? "on" : "none"} label={s.name} onToggle={() => toggle(s.id)} />
        <SpaceIcon icon={s.icon} />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          color: on ? undefined : theme.textFaint }}>{s.name}</span>
      </div>
    );
  };

  return (
    <div role="presentation" onClick={() => !busy && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", animation: overlayIn,
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <style>{overlayAnimationCss + triCheckboxCss + exportCss}</style>
      <div role="dialog" aria-modal="true" aria-label="스페이스 내보내기" onClick={(e) => e.stopPropagation()}
        style={{ boxSizing: "border-box", width: 340, maxWidth: "calc(100vw - 32px)", animation: panelIn,
          background: theme.surface, borderRadius: 14, padding: "20px 18px 16px",
          boxShadow: "0 18px 50px rgba(0,0,0,.26)", fontSize: 13 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>스페이스 내보내기</div>
        <div style={{ marginTop: 4, fontSize: 12.5, color: theme.textMuted }}>고른 스페이스를 JSON 파일 하나로 저장해요</div>

        <div onClick={toggleAll}
          style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14, padding: "8px 10px",
            borderBottom: `1px solid ${theme.border}`, fontWeight: 600, color: theme.text, cursor: "pointer", userSelect: "none" }}>
          <TriCheckbox state={n === 0 ? "none" : n === total ? "on" : "some"} label="전체 선택" onToggle={toggleAll} />
          <span>전체 선택</span>
          <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: theme.textFaint,
            fontVariantNumeric: "tabular-nums" }}>{n} / {total}</span>
        </div>

        <div style={{ maxHeight: 330, overflow: "auto", padding: "4px 0" }}>
          {mine.map(row)}
          {shared.length > 0 && (
            <>
              <div style={{ padding: "8px 10px 3px", fontSize: 10, fontWeight: 700, color: theme.textFaint }}>공유 스페이스</div>
              {shared.map(row)}
            </>
          )}
        </div>

        <div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.6, color: theme.textFaint }}>
          아이콘·메모·비공개 설정은 담기지 않아요
        </div>
        {error && <div style={{ marginTop: 6, fontSize: 12, color: theme.danger }}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <Button variant="outline" onClick={onClose} disabled={busy}>취소</Button>
          <Button onClick={submit} disabled={n === 0 || busy}>
            {busy ? "내보내는 중…" : n === 0 ? "내보내기" : `${n}개 내보내기`}
          </Button>
        </div>
      </div>
    </div>
  );
}
