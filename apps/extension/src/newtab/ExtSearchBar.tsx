import { useState } from "react";
import { Search, Favicon, theme } from "@tablign/ui";
import {
  searchCollections,
  searchLinks,
  type CollectionSearchResult,
  type LinkSearchResult,
} from "@tablign/core";
import { supabase } from "../lib/supabase";

function openUrl(url: string) { chrome.tabs.create({ url }); }

/** 검색 결과 우측에 소속 스페이스를 옅게 표시한다. */
function SpaceTag({ icon, name }: { icon: string | null; name: string }) {
  return (
    <span style={{ marginLeft: 6, flexShrink: 0, color: theme.textFaint, fontSize: 11 }}>
      {icon ? `${icon} ` : ""}{name}
    </span>
  );
}

export function ExtSearchBar() {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [res, setRes] = useState<{ collections: CollectionSearchResult[]; links: LinkSearchResult[] } | null>(null);

  async function run(value: string) {
    setQ(value);
    if (!value.trim()) { setRes(null); return; }
    const [collections, links] = await Promise.all([
      searchCollections(supabase, value),
      searchLinks(supabase, value),
    ]);
    setRes({ collections, links });
  }

  const open = focused && res && q.trim().length > 0;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, background: theme.surface2, borderRadius: 8, padding: "7px 10px", color: theme.textMuted }}>
        <Search size={15} />
        <input
          value={q}
          onChange={(e) => run(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="검색"
          style={{ border: "none", background: "none", outline: "none", fontSize: 13, width: "100%", color: theme.text }}
        />
      </div>
      {open && (
        <div
          // 드롭다운 내부를 클릭할 때 인풋이 blur 되어 닫히지 않도록 막는다.
          onMouseDown={(e) => e.preventDefault()}
          style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.12)", padding: 8, zIndex: 30, maxHeight: 320, overflow: "auto" }}
        >
          {res!.collections.length === 0 && res!.links.length === 0 && (
            <div style={{ color: theme.textFaint, padding: 6, fontSize: 12 }}>결과 없음</div>
          )}
          {res!.collections.map((c) => (
            <div key={`c-${c.id}`} style={{ display: "flex", alignItems: "center", padding: 6, fontSize: 12, color: theme.textMuted }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>＃ {c.title}</span>
              {c.space && <SpaceTag icon={c.space.icon} name={c.space.name} />}
            </div>
          ))}
          {res!.links.map((l) => (
            <button key={`l-${l.id}`} type="button" onClick={() => openUrl(l.url)}
              style={{ display: "flex", gap: 6, alignItems: "center", width: "100%", textAlign: "left", border: "none", background: "none", cursor: "pointer", padding: 6, fontSize: 12 }}>
              <Favicon url={l.favicon_url} size={14} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.custom_title ?? l.title ?? l.url}</span>
              {l.collection?.space && <SpaceTag icon={l.collection.space.icon} name={l.collection.space.name} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
