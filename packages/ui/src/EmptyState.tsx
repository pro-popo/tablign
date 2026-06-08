import type { ReactNode } from "react";
import { theme } from "./theme";

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div style={{ padding: 24, textAlign: "center", color: theme.textMuted }}>
      <div style={{ marginBottom: action ? 10 : 0 }}>{title}</div>
      {action}
    </div>
  );
}
