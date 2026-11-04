import type { ReactNode } from "react";
import { theme } from "./theme";

/** 여러 칸 중 하나를 고르는 토글(모드·배경 종류) */
export function Segmented<T extends string>({ items, value, onChange, small }: {
  items: { value: T; label: string; icon?: ReactNode }[]; value: T; onChange: (v: T) => void; small?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 8, background: theme.surface2 }}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button key={it.value} type="button" aria-pressed={on} onClick={() => onChange(it.value)}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, border: "none", borderRadius: 6,
              padding: "6px 0", fontFamily: "inherit", fontSize: small ? 11.5 : 12, whiteSpace: "nowrap", cursor: "pointer",
              background: on ? theme.surface : "none", color: on ? theme.text : theme.textMuted, fontWeight: on ? 600 : 400,
              boxShadow: on ? `0 1px 2px rgba(0,0,0,.08), 0 0 0 1px ${theme.border}` : "none" }}>
            {it.icon}{it.label}
          </button>
        );
      })}
    </div>
  );
}
