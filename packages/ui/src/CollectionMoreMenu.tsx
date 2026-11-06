import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, ArrowLeft } from "./icons";
import { theme } from "./theme";
import { useT } from "./i18n";
import { SpaceIcon } from "./SpaceIcon";

export interface SpaceOption { id: string; name: string; icon?: string | null }

export interface CollectionMoreMenuProps {
  /** 현재 스페이스를 제외한 이동/복사 대상 스페이스 목록 */
  spaces: SpaceOption[];
  onMove: (spaceId: string) => void;
  onCopy: (spaceId: string) => void;
  onShare?: () => void;
  /** 컬렉션 링크 전체를 클립보드로 복사 */
  onCopyLinks?: () => void;
  isPrivate?: boolean;
  onTogglePrivate?: () => void;
}

/** 컬렉션 헤더의 ⋯ 메뉴. 이동/복사 → 스페이스 선택 2단계 팝오버. */
export function CollectionMoreMenu({ spaces, onMove, onCopy, onShare, onCopyLinks, isPrivate, onTogglePrivate }: CollectionMoreMenuProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"move" | "copy" | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);

  // 바깥 클릭으로 닫기
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function close() { setOpen(false); setMode(null); }
  function pick(spaceId: string) {
    (mode === "move" ? onMove : onCopy)(spaceId);
    close();
  }

  return (
    <span ref={rootRef} style={{ position: "relative", display: "flex" }}>
      <button
        type="button"
        title={t.collectionMoreMenu.menu}
        aria-label={t.collectionMoreMenu.menu}
        onClick={() => (open ? close() : setOpen(true))}
        style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 3, borderRadius: 6 }}
      >
        <MoreHorizontal size={15} color={theme.textMuted} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "100%", right: 0, marginTop: 4, zIndex: 50, minWidth: 168,
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10,
            boxShadow: "0 8px 20px rgba(20,30,60,.14)", padding: 4,
          }}
        >
          <style>{menuItemCss}</style>
          {mode === null ? (
            <>
              {spaces.length > 0 && (
                <>
                  <button type="button" className="tbl-cmenu-item" style={itemStyle} onClick={() => setMode("move")}>{t.collectionMoreMenu.moveTo}</button>
                  <button type="button" className="tbl-cmenu-item" style={itemStyle} onClick={() => setMode("copy")}>{t.collectionMoreMenu.copyTo}</button>
                </>
              )}
              {onCopyLinks && (
                <button type="button" className="tbl-cmenu-item" style={itemStyle} onClick={() => { onCopyLinks(); close(); }}>{t.collectionMoreMenu.copyLinks}</button>
              )}
              {onShare && (
                <button type="button" className="tbl-cmenu-item" style={itemStyle} onClick={() => { onShare(); close(); }}>{t.collectionMoreMenu.shareCode}</button>
              )}
              {onTogglePrivate && (
                <button type="button" className="tbl-cmenu-item" style={itemStyle} onClick={() => { onTogglePrivate(); close(); }}>
                  {isPrivate ? t.collectionMoreMenu.makePublic : t.collectionMoreMenu.makePrivate}
                </button>
              )}
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 6px", color: theme.textFaint, fontSize: 12 }}>
                <button
                  type="button"
                  title={t.collectionMoreMenu.back}
                  aria-label={t.collectionMoreMenu.back}
                  onClick={() => setMode(null)}
                  style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 2 }}
                >
                  <ArrowLeft size={13} color={theme.textFaint} />
                </button>
                {mode === "move" ? t.collectionMoreMenu.moveTarget : t.collectionMoreMenu.copyTarget}
              </div>
              {spaces.map((s) => (
                <button key={s.id} type="button" className="tbl-cmenu-item" style={{ ...itemStyle, display: "flex", alignItems: "center", gap: 8 }} onClick={() => pick(s.id)}>
                  <SpaceIcon icon={s.icon} /> {s.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </span>
  );
}

/** 항목 호버 배경. 인라인 background는 :hover를 이길 수 없어 배경은 여기서만 정한다. 조직 메뉴와 같은 색. */
const menuItemCss = `.tbl-cmenu-item { background: none } .tbl-cmenu-item:hover { background: ${theme.surface2} }`;

const itemStyle: React.CSSProperties = {
  display: "block", width: "100%", textAlign: "left", border: "none",
  cursor: "pointer", padding: "7px 9px", borderRadius: 7, fontSize: 13, color: theme.text,
};
