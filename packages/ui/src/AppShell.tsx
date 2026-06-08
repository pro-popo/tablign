import type { ReactNode } from "react";
import { SidePanel } from "./SidePanel";
import { Button } from "./Button";
import { PanelRightOpen } from "./icons";
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

export function AppShell({ left, right, children, leftOpen, rightOpen, onToggleRight }: AppShellProps) {
  return (
    <div style={{ display: "flex", height: "100vh", background: theme.bg, color: theme.text, fontFamily: "-apple-system, system-ui, sans-serif", fontSize: 13 }}>
      {leftOpen && <SidePanel side="left" width={212}>{left}</SidePanel>}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}>
        {children}
        {right && !rightOpen && (
          <div style={{ position: "absolute", top: 10, right: 12 }}>
            <Button variant="outline" aria-label="열린 탭 열기" onClick={onToggleRight}>
              <PanelRightOpen size={15} /> 열린 탭
            </Button>
          </div>
        )}
      </main>
      {right && rightOpen && <SidePanel side="right" width={272}>{right}</SidePanel>}
    </div>
  );
}
