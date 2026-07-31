import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Ticket } from "./icons";
import { theme } from "./theme";

export interface AddCollectionButtonProps {
  /** 본체(＋ 컬렉션) 클릭 — 빈 컬렉션을 바로 만든다 */
  onCreate: () => void;
  /** 메뉴의 '공유 코드로 추가' */
  onImportCode: () => void;
}

/**
 * 보드 헤더의 '＋ 컬렉션' split 버튼.
 *
 * 본체를 누르면 기존과 똑같이 빈 컬렉션이 바로 생기고(가장 흔한 동작에 클릭을 더하지 않는다),
 * ▾를 누르면 '공유 코드로 추가'까지 있는 메뉴가 열린다.
 *
 * 공유 코드 진입점이 여기인 이유: 코드로 추가되는 단위는 스페이스가 아니라 **컬렉션**이다
 * (import_collection_by_code가 컬렉션 1행 + 링크들을 복사). 컬렉션을 만들려는 의도가 생기는
 * 지점에 두 경로를 나란히 둔다.
 */
export function AddCollectionButton({ onCreate, onImportCode }: AddCollectionButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <span ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      <span style={{ display: "inline-flex", alignItems: "stretch", borderRadius: theme.radiusBtn, overflow: "hidden", background: theme.accent }}>
        <button type="button" onClick={onCreate} style={mainStyle}>
          <Plus size={15} /> 컬렉션
        </button>
        <span style={{ width: 1, background: "rgba(255,255,255,.32)" }} />
        <button
          type="button"
          title="컬렉션 추가 방법"
          aria-label="컬렉션 추가 방법"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={caretStyle}
        >
          <span style={{ display: "flex", transition: "transform .16s", transform: open ? "rotate(180deg)" : undefined }}>
            <ChevronDown size={11} />
          </span>
        </button>
      </span>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", top: "100%", right: 0, marginTop: 4, zIndex: 50, minWidth: 168,
            background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 10,
            // 그림자는 시안값 대신 CollectionMoreMenu와 같은 값으로 — 같은 종류의 팝오버끼리 어긋나면 안 된다
            boxShadow: "0 8px 20px rgba(20,30,60,.14)", padding: 5, boxSizing: "border-box",
          }}
        >
          <button type="button" role="menuitem" style={itemStyle} onClick={() => { onCreate(); setOpen(false); }}>
            <Plus size={15} color={theme.textMuted} /> 새 컬렉션
          </button>
          <div style={{ height: 1, background: theme.border, margin: "4px 2px" }} />
          <button type="button" role="menuitem" style={itemStyle} onClick={() => { onImportCode(); setOpen(false); }}>
            <Ticket size={15} color={theme.textMuted} /> 공유 코드로 추가
          </button>
        </div>
      )}
    </span>
  );
}

const mainStyle: React.CSSProperties = {
  boxSizing: "border-box",
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 11px", border: "none", background: "none",
  // fontFamily만 inherit — font 단축 속성을 쓰면 뒤에 오는 fontSize/fontWeight를 되돌린다
  fontFamily: "inherit", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

const caretStyle: React.CSSProperties = {
  boxSizing: "border-box",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "0 7px", border: "none", background: "none", color: "#fff", cursor: "pointer",
};

const itemStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
  border: "none", background: "none", cursor: "pointer", padding: "8px 10px",
  borderRadius: 7, fontFamily: "inherit", fontSize: 13, color: theme.text,
  boxSizing: "border-box",
};
