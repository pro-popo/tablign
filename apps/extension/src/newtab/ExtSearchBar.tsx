import { useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Search, Favicon, SpaceIcon, theme } from "@tablign/ui";
import { searchLinks, type LinkSearchResult } from "@tablign/core";
import { supabase } from "../lib/supabase";

function openUrl(url: string) { chrome.tabs.create({ url }); }

const searchCss = `
.tbl-sr-box { background: ${theme.surface2}; border: 1px solid transparent; color: ${theme.textMuted};
  transition: background .14s ease, border-color .14s ease, box-shadow .14s ease, color .14s ease }
.tbl-sr-box:focus-within { background: ${theme.surface}; border-color: ${theme.accent}; box-shadow: 0 0 0 3px ${theme.accentWeak}; color: ${theme.accentInk} }
.tbl-sr-link:hover { background: ${theme.surface2} }
.tbl-sr-space:hover { background: ${theme.surface3} }
`;

/** 보고 있는 조직(orgId) 안의 링크를 찾는다. 조직이 아직 정해지지 않았으면 찾지 않는다. */
export function ExtSearchBar({ orgId, onSelectSpace }: { orgId: string | null; onSelectSpace: (spaceId: string) => void }) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [res, setRes] = useState<LinkSearchResult[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const latest = useRef(0);
  /** 스페이스 아이콘 말풍선 — 결과 창이 스크롤 영역이라 잘리지 않게 body에 띄운다 */
  const [tip, setTip] = useState<{ name: string; top: number; right: number } | null>(null);

  function showTip(e: MouseEvent<HTMLElement>, name: string) {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ name, top: r.bottom + 5, right: window.innerWidth - r.right });
  }

  async function run(value: string) {
    setQ(value);
    setTip(null);
    const req = ++latest.current;
    if (!value.trim() || !orgId) { setRes(null); return; }
    const found = await searchLinks(supabase, value, orgId);
    // 빠르게 칠 때 앞 글자 검색이 늦게 도착해 최신 결과를 덮지 않게 한다
    if (req === latest.current) setRes(found);
  }

  const open = focused && res && q.trim().length > 0;

  return (
    <div style={{ position: "relative" }}>
      <style>{searchCss}</style>
      <div className="tbl-sr-box" style={{ display: "flex", alignItems: "center", gap: 7, borderRadius: 8, padding: "6px 9px" }}>
        <Search size={15} />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => run(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="탭 검색"
          style={{ border: "none", background: "none", outline: "none", fontSize: 13, width: "100%", color: theme.text }}
        />
      </div>
      {open && (
        <div
          // 드롭다운 내부를 클릭할 때 인풋이 blur 되어 닫히지 않도록 막는다.
          onMouseDown={(e) => e.preventDefault()}
          onScroll={() => setTip(null)}
          style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.12)", padding: 8, zIndex: 30, maxHeight: 320, overflow: "auto" }}
        >
          {res!.length === 0 && (
            <div style={{ color: theme.textFaint, padding: 6, fontSize: 12 }}>결과 없음</div>
          )}
          {res!.map((l) => (
            <div key={l.id} className="tbl-sr-link" style={{ display: "flex", alignItems: "center", borderRadius: 6 }}>
              <button type="button" onClick={() => openUrl(l.url)}
                style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, minWidth: 0, textAlign: "left", border: "none", background: "none", cursor: "pointer", padding: 6, fontSize: 12, color: theme.text }}>
                <Favicon url={l.favicon_url} size={14} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.custom_title ?? l.title ?? l.url}</span>
              </button>
              <button type="button" className="tbl-sr-space" aria-label={l.collection.space.name}
                onMouseEnter={(e) => showTip(e, l.collection.space.name)} onMouseLeave={() => setTip(null)}
                onClick={() => { setTip(null); onSelectSpace(l.collection.space.id); inputRef.current?.blur(); }}
                style={{ flexShrink: 0, display: "flex", border: "none", background: "none", cursor: "pointer", padding: "3px 5px", marginRight: 3, borderRadius: 6 }}>
                <SpaceIcon icon={l.collection.space.icon} />
              </button>
            </div>
          ))}
        </div>
      )}
      {open && tip && createPortal(
        <div role="tooltip" style={{ position: "fixed", top: tip.top, right: tip.right, zIndex: 1000, padding: "4px 8px", borderRadius: 6,
          background: theme.text, color: theme.surface, fontSize: 11, whiteSpace: "nowrap", pointerEvents: "none" }}>{tip.name}</div>,
        document.body,
      )}
    </div>
  );
}
