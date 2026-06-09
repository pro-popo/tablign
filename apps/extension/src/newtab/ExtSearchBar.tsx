import { useState } from "react";
import { Search, Favicon, theme } from "@tablign/ui";
import { searchCollections, searchLinks, type Collection, type Link } from "@tablign/core";
import { supabase } from "../lib/supabase";

function openUrl(url: string) { chrome.tabs.create({ url }); }

export function ExtSearchBar() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ collections: Collection[]; links: Link[] } | null>(null);

  async function run(value: string) {
    setQ(value);
    if (!value.trim()) { setRes(null); return; }
    const [collections, links] = await Promise.all([
      searchCollections(supabase, value),
      searchLinks(supabase, value),
    ]);
    setRes({ collections, links });
  }

  const open = res && q.trim().length > 0;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, background: theme.surface2, borderRadius: 8, padding: "7px 10px", color: theme.textMuted }}>
        <Search size={15} />
        <input
          value={q}
          onChange={(e) => run(e.target.value)}
          placeholder="검색"
          style={{ border: "none", background: "none", outline: "none", fontSize: 13, width: "100%", color: theme.text }}
        />
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.12)", padding: 8, zIndex: 30, maxHeight: 320, overflow: "auto" }}>
          {res!.collections.length === 0 && res!.links.length === 0 && (
            <div style={{ color: theme.textFaint, padding: 6, fontSize: 12 }}>결과 없음</div>
          )}
          {res!.collections.map((c) => (
            <div key={`c-${c.id}`} style={{ padding: 6, fontSize: 12, color: theme.textMuted }}>＃ {c.title}</div>
          ))}
          {res!.links.map((l) => (
            <button key={`l-${l.id}`} type="button" onClick={() => openUrl(l.url)}
              style={{ display: "flex", gap: 6, alignItems: "center", width: "100%", textAlign: "left", border: "none", background: "none", cursor: "pointer", padding: 6, fontSize: 12 }}>
              <Favicon url={l.favicon_url} size={14} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.custom_title ?? l.title ?? l.url}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
