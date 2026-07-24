import { useMemo, useRef, useState, type CSSProperties } from "react";
import { buildTossCategories } from "./tossEmoji";
import { ORG_ICON_FONT } from "./orgIcon";

export interface TossEmojiPickerProps {
  onSelect: (native: string) => void;
}

export function TossEmojiPicker({ onSelect }: TossEmojiPickerProps) {
  const categories = useMemo(() => buildTossCategories(), []);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<{ native: string; name: string } | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const q = query.trim().toLowerCase();
  const visible = categories
    .map((c) => ({ ...c, items: q ? c.items.filter((it) => it.search.includes(q)) : c.items }))
    .filter((c) => c.items.length);

  return (
    <div style={wrap}>
      <style>{scrollCss}</style>
      <div style={tabsBar}>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            title={c.label}
            aria-label={c.label}
            style={{ ...tabBtn, fontFamily: ORG_ICON_FONT }}
            onClick={() => {
              // 탭 이동 시 검색을 초기화한다. setQuery("")의 재렌더가 rAF보다 먼저 커밋되어
              // 해당 섹션 ref가 채워진 뒤 스크롤된다(전체 섹션이 다시 보이므로 ref 존재 보장).
              setQuery("");
              requestAnimationFrame(() => sectionRefs.current[c.id]?.scrollIntoView({ block: "start" }));
            }}
          >
            {c.tab}
          </button>
        ))}
      </div>

      <div style={searchWrap}>
        <div style={searchBox}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#adb5bd" strokeWidth={2} strokeLinecap="round" style={{ flex: "none" }} aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색"
            aria-label="이모지 검색"
            style={searchInput}
          />
        </div>
      </div>

      <div className="toss-picker-body" style={bodyBox}>
        {visible.length === 0 ? (
          <div style={emptyBox}>검색 결과가 없어요</div>
        ) : (
          visible.map((c) => (
            <div key={c.id} ref={(el) => { sectionRefs.current[c.id] = el; }}>
              <div style={catLabel}>{c.label}</div>
              <div style={grid}>
                {c.items.map((it) => (
                  <button
                    key={it.native}
                    type="button"
                    title={it.name}
                    aria-label={it.name}
                    style={{ ...cell, fontFamily: ORG_ICON_FONT }}
                    onMouseEnter={() => setPreview({ native: it.native, name: it.name })}
                    onFocus={() => setPreview({ native: it.native, name: it.name })}
                    onClick={() => onSelect(it.native)}
                  >
                    {it.native}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={footBox}>
        <span style={{ ...footBig, fontFamily: ORG_ICON_FONT }}>{preview?.native ?? "🚀"}</span>
        <span data-testid="toss-preview-name" style={footName}>{preview?.name ?? "로켓"}</span>
        <span style={attrText}>토스페이스 · 토스팀 제공</span>
      </div>
    </div>
  );
}

// 얇은 스크롤바 — inline 스타일로는 ::-webkit-scrollbar를 지정할 수 없어 클래스 스코프 CSS로 주입.
const scrollCss = `
  .toss-picker-body { scrollbar-width: thin; scrollbar-color: #d0d4da transparent; }
  .toss-picker-body::-webkit-scrollbar { width: 8px; }
  .toss-picker-body::-webkit-scrollbar-thumb { background: #d0d4da; border-radius: 8px; border: 2px solid #fff; }
  .toss-picker-body::-webkit-scrollbar-track { background: transparent; }
`;

const wrap: CSSProperties = { width: 376, maxWidth: "calc(100vw - 48px)", background: "#fff", borderRadius: 14, overflow: "hidden", boxSizing: "border-box" };
const tabsBar: CSSProperties = { display: "flex", gap: 2, padding: "6px 10px", borderBottom: "1px solid #f1f3f5" };
const tabBtn: CSSProperties = { flex: 1, border: "none", background: "none", fontSize: 18, lineHeight: 1, padding: "6px 0", borderRadius: 8, cursor: "pointer", color: "#868e96" };
const searchWrap: CSSProperties = { padding: "10px 12px" };
// emoji-mart 스타일: 회색 필드 + 좌측 돋보기 아이콘, 테두리 없음.
const searchBox: CSSProperties = { display: "flex", alignItems: "center", gap: 8, background: "#f1f3f5", borderRadius: 10, padding: "9px 12px" };
const searchInput: CSSProperties = { flex: 1, border: "none", background: "none", outline: "none", fontSize: 13.5, color: "#343a40", minWidth: 0 };
const bodyBox: CSSProperties = { height: 280, overflowY: "auto", padding: "0 10px 10px" };
const catLabel: CSSProperties = { fontSize: 12, fontWeight: 600, color: "#868e96", padding: "10px 2px 6px", position: "sticky", top: 0, background: "#fff" };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 2 };
const cell: CSSProperties = { border: "none", background: "none", fontSize: 22, lineHeight: 1, padding: "5px 0", borderRadius: 7, cursor: "pointer" };
const emptyBox: CSSProperties = { padding: "24px 8px", textAlign: "center", color: "#adb5bd", fontSize: 12.5 };
const footBox: CSSProperties = { borderTop: "1px solid #f1f3f5", padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, minHeight: 44 };
const footBig: CSSProperties = { fontSize: 26 };
const footName: CSSProperties = { fontSize: 12.5, color: "#868e96" };
const attrText: CSSProperties = { marginLeft: "auto", fontSize: 10.5, color: "#ced4da" };
