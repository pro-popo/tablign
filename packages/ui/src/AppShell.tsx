import type { ReactNode } from "react";
import { PanelLeftOpen, PanelRightOpen } from "./icons";
import { theme } from "./theme";

export interface AppShellProps {
  left: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}

const RAIL = 44;

function Rail({ onClick, label, icon }: { onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 10 }}>
      <button type="button" title={label} aria-label={label} onClick={onClick}
        style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 4, height: "fit-content" }}>
        {icon}
      </button>
    </div>
  );
}

export function AppShell({ left, right, children, leftOpen, rightOpen, onToggleLeft, onToggleRight }: AppShellProps) {
  const panel = (side: "left" | "right", open: boolean, openWidth: number): React.CSSProperties => ({
    width: open ? openWidth : RAIL,
    flexShrink: 0,
    transition: "width 0.2s ease",
    overflow: "hidden",
    background: theme.surface,
    [side === "left" ? "borderRight" : "borderLeft"]: `1px solid ${theme.border}`,
    height: "100%",
    display: "flex",
    flexDirection: "column",
  });

  return (
    <div style={{ display: "flex", height: "100vh", background: theme.bg, color: theme.text, fontFamily: "-apple-system, system-ui, sans-serif", fontSize: 13 }}>
      <aside style={panel("left", leftOpen, 212)}>
        {leftOpen ? left : <Rail onClick={onToggleLeft} label="사이드바 열기" icon={<PanelLeftOpen size={18} color={theme.textFaint} />} />}
      </aside>
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </main>
      {right && (
        <aside style={panel("right", rightOpen, 272)}>
          {rightOpen ? right : <Rail onClick={onToggleRight} label="열린 탭 열기" icon={<PanelRightOpen size={18} color={theme.textFaint} />} />}
        </aside>
      )}
    </div>
  );
}
