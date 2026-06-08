import type { ReactNode } from "react";
import { theme } from "./theme";

export function SidePanel({
  side, width, children,
}: { side: "left" | "right"; width: number; children: ReactNode }) {
  return (
    <aside
      style={{
        width,
        flexShrink: 0,
        background: theme.surface,
        [side === "left" ? "borderRight" : "borderLeft"]: `1px solid ${theme.border}`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {children}
    </aside>
  );
}
