import type { Space } from "@tablign/core";

export interface SidebarProps {
  spaces: Space[];
  activeSpaceId: string | null;
  onSelectSpace: (spaceId: string) => void;
  onAddSpace: () => void;
}

export function Sidebar({ spaces, activeSpaceId, onSelectSpace, onAddSpace }: SidebarProps) {
  return (
    <nav
      style={{
        width: 200,
        flexShrink: 0,
        background: "#1e2330",
        color: "#cfd3dc",
        padding: 16,
        height: "100vh",
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontWeight: 700, color: "#fff", marginBottom: 16 }}>🗂 tablign</div>
      <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.6, marginBottom: 8 }}>SPACES</div>
      {spaces.map((space) => (
        <button
          key={space.id}
          type="button"
          onClick={() => onSelectSpace(space.id)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "6px 8px",
            marginBottom: 4,
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            background: space.id === activeSpaceId ? "#2c3346" : "transparent",
            color: "inherit",
          }}
        >
          {space.icon ? `${space.icon} ` : ""}
          {space.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onAddSpace}
        style={{ marginTop: 8, background: "none", border: "none", color: "#8ab4ff", cursor: "pointer" }}
      >
        + 스페이스 추가
      </button>
    </nav>
  );
}
