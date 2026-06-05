import type { Link } from "@tablign/core";

export interface LinkCardProps {
  link: Link;
  onOpen: (url: string) => void;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function LinkCard({ link, onOpen }: LinkCardProps) {
  const label = link.custom_title ?? link.title ?? domainOf(link.url);
  return (
    <button
      type="button"
      onClick={() => onOpen(link.url)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: 8,
        textAlign: "left",
        border: "1px solid #eee",
        borderRadius: 6,
        background: "#fff",
        cursor: "pointer",
      }}
    >
      {link.favicon_url ? (
        <img src={link.favicon_url} alt="" width={16} height={16} />
      ) : (
        <span aria-hidden style={{ width: 16, height: 16 }}>🔗</span>
      )}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
    </button>
  );
}
