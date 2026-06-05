import type { ReactNode } from "react";

export interface BoardProps {
  children: ReactNode;
}

export function Board({ children }: BoardProps) {
  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: 16, alignItems: "flex-start" }}>
      {children}
    </div>
  );
}
