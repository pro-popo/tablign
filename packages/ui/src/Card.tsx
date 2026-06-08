import type { CSSProperties, ReactNode } from "react";
import { theme } from "./theme";

export function Card({
  children,
  style,
  ...rest
}: { children: ReactNode; style?: CSSProperties } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      style={{
        background: theme.surface,
        border: `1px solid ${theme.borderCard}`,
        borderRadius: theme.radiusCard,
        padding: "10px 11px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
