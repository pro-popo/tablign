"use client";

import { useDeferredValue, useState } from "react";
import { useSearch } from "@/lib/queries";

function openUrl(url: string) {
  window.open(url, "_blank", "noopener");
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  // 매 키 입력마다 요청하지 않도록 지연된 값으로 검색한다.
  const deferredQuery = useDeferredValue(query);
  const { data } = useSearch(deferredQuery);
  const hasResults = deferredQuery.trim().length > 0 && data;

  return (
    <div style={{ position: "relative" }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="컬렉션·링크 검색"
        style={{ width: 280, padding: 6, border: "1px solid #ddd", borderRadius: 6 }}
      />
      {hasResults && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            width: 320,
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,.12)",
            padding: 8,
            zIndex: 10,
            maxHeight: 360,
            overflowY: "auto",
          }}
        >
          {data!.collections.length === 0 && data!.links.length === 0 && (
            <div style={{ color: "#888", padding: 8 }}>결과 없음</div>
          )}
          {data!.collections.map((c) => (
            <div key={`c-${c.id}`} style={{ padding: 6 }}>
              📁 {c.title}
            </div>
          ))}
          {data!.links.map((l) => (
            <button
              key={`l-${l.id}`}
              type="button"
              onClick={() => openUrl(l.url)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: 6,
                border: "none",
                background: "none",
                cursor: "pointer",
              }}
            >
              🔗 {l.custom_title ?? l.title ?? l.url}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
