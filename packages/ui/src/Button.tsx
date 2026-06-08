import type { ButtonHTMLAttributes, ReactNode } from "react";
import { theme } from "./theme";

type Variant = "primary" | "ghost" | "outline";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const styles: Record<Variant, React.CSSProperties> = {
  primary: { background: theme.accent, color: "#fff", border: "none" },
  ghost: { background: "transparent", color: theme.textMuted, border: "none" },
  outline: { background: "#fff", color: "#5c636b", border: `1px solid ${theme.border}` },
};

export function Button({ variant = "primary", children, style, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 11px",
        borderRadius: theme.radiusBtn,
        fontWeight: 600,
        fontSize: 13,
        cursor: "pointer",
        ...styles[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function IconButton({ children, style, ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 7,
        border: "none",
        background: "transparent",
        color: theme.textFaint,
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
