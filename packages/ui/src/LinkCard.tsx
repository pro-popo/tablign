import { useState } from "react";
import type { Link } from "@tablign/core";
import { Favicon } from "./Favicon";
import { ExternalLink, Trash2 } from "./icons";
import { theme } from "./theme";

export interface LinkCardProps {
  link: Link;
  onOpen: (url: string) => void;
  onDelete: (id: string) => void;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function LinkCard({ link, onOpen, onDelete }: LinkCardProps) {
  const [hover, setHover] = useState(false);
  const label = link.custom_title ?? link.title ?? domainOf(link.url);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        background: theme.surface,
        border: `1px solid ${theme.borderCard}`,
        borderRadius: theme.radiusCard,
        padding: "10px 11px",
      }}
    >
      <button
        type="button"
        aria-label={label}
        onClick={() => onOpen(link.url)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          gap: 8,
          alignItems: "center",
          width: "100%",
        }}
      >
        <Favicon url={link.favicon_url} />
        <span
          style={{
            fontWeight: 600,
            color: theme.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      </button>
      {label !== domainOf(link.url) && (
        <div style={{ color: theme.textFaint, fontSize: 11, marginTop: 5 }}>{domainOf(link.url)}</div>
      )}
      <div
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          display: "flex",
          gap: 2,
          opacity: hover ? 1 : 0,
          pointerEvents: hover ? "auto" : "none",
          transition: "opacity 0.15s",
        }}
      >
        <button
          type="button"
          aria-label="열기"
          onClick={() => onOpen(link.url)}
          style={{
            border: "none",
            background: theme.surface2,
            borderRadius: 6,
            padding: 4,
            cursor: "pointer",
            display: "flex",
          }}
        >
          <ExternalLink size={14} color={theme.textMuted} />
        </button>
        <button
          type="button"
          aria-label="삭제"
          onClick={() => onDelete(link.id)}
          style={{
            border: "none",
            background: theme.surface2,
            borderRadius: 6,
            padding: 4,
            cursor: "pointer",
            display: "flex",
          }}
        >
          <Trash2 size={14} color={theme.danger} />
        </button>
      </div>
    </div>
  );
}
