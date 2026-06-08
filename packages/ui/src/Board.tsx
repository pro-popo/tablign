import type { ReactNode } from "react";

export interface BoardProps {
  children: ReactNode;
}

export function Board({ children }: BoardProps) {
  return <div style={{ padding: "16px 18px", overflow: "auto", height: "100%", boxSizing: "border-box" }}>{children}</div>;
}
