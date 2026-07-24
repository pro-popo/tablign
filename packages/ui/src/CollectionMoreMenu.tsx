import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, ArrowLeft } from "./icons";
import { theme } from "./theme";

export interface SpaceOption { id: string; name: string; icon?: string | null }

export interface CollectionMoreMenuProps {
  /** 현재 스페이스를 제외한 이동/복사 대상 스페이스 목록 */
  spaces: SpaceOption[];
  onMove: (spaceId: string) => void;
  onCopy: (spaceId: string) => void;
  onShare?: () => void;
  isPrivate?: boolean;
  onTogglePrivate?: () => void;
}

/** 컬렉션 헤더의 ⋯ 메뉴. 이동/복사 → 스페이스 선택 2단계 팝오버. */
export function CollectionMoreMenu({ spaces, onMove, onCopy, onShare, isPrivate, onTogglePrivate }: CollectionMoreMenuProps) {
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
        title="컬렉션 메뉴"
        aria-label="컬렉션 메뉴"
        onClick={() => (open ? close() : setOpen(true))}
        style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 3, borderRadius: 6 }}
      >
        <MoreHorizontal size={15} color={theme.textMuted} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "100%", right: 0, marginTop: 4, zIndex: 50, minWidth: 168,
            background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 10,
            boxShadow: "0 8px 20px rgba(20,30,60,.14)", padding: 4,
          }}
        >
          {mode === null ? (
            <>
              {spaces.length > 0 && (
                <>
                  <button type="button" style={itemStyle} onClick={() => setMode("move")}>다른 스페이스로 이동</button>
                  <button type="button" style={itemStyle} onClick={() => setMode("copy")}>다른 스페이스에 복사</button>
                </>
              )}
              {onShare && (
                <button type="button" style={itemStyle} onClick={() => { onShare(); close(); }}>공유 코드</button>
              )}
              {onTogglePrivate && (
                <button type="button" style={itemStyle} onClick={() => { onTogglePrivate(); close(); }}>
                  {isPrivate ? "공개로 전환" : "비공개로 전환"}
                </button>
              )}
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 6px", color: theme.textFaint, fontSize: 12 }}>
                <button
                  type="button"
                  title="뒤로"
                  aria-label="뒤로"
                  onClick={() => setMode(null)}
                  style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 2 }}
                >
                  <ArrowLeft size={13} color={theme.textFaint} />
                </button>
                {mode === "move" ? "이동할 스페이스" : "복사할 스페이스"}
              </div>
              {spaces.map((s) => (
                <button key={s.id} type="button" style={itemStyle} onClick={() => pick(s.id)}>
                  {s.icon ? `${s.icon} ` : ""}{s.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </span>
  );
}

const itemStyle: React.CSSProperties = {
  display: "block", width: "100%", textAlign: "left", border: "none", background: "none",
  cursor: "pointer", padding: "7px 9px", borderRadius: 7, fontSize: 13, color: theme.text,
};
