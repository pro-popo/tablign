import { theme } from "./theme";

const INK = "#1f2430";
const NEUTRAL = "#c9d4ff";

export interface LogoMarkProps {
  /** Mark size in px (square). */
  size?: number;
  /** "light" for light surfaces (default), "dark" for dark backgrounds. */
  tone?: "light" | "dark";
  title?: string;
}

/** tablign "Bento" mark — an asymmetric board of four cells. */
export function LogoMark({ size = 24, tone = "light", title = "tablign" }: LogoMarkProps) {
  const accent = tone === "dark" ? "#5a73e0" : theme.accent;
  const ink = tone === "dark" ? "#ffffff" : INK;
  const neutral = tone === "dark" ? "#2b3142" : NEUTRAL;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" role="img" aria-label={title}>
      <rect x="4" y="4" width="24" height="24" rx="6" fill={accent} />
      <rect x="32" y="4" width="12" height="12" rx="4" fill={ink} />
      <rect x="32" y="20" width="12" height="24" rx="4" fill={neutral} />
      <rect x="4" y="32" width="24" height="12" rx="4" fill={neutral} />
    </svg>
  );
}

export interface LogoProps extends LogoMarkProps {
  /** Show the "tablign" wordmark next to the mark. */
  withWordmark?: boolean;
  gap?: number;
}

/** Full lockup: Bento mark + "tablign" wordmark. */
export function Logo({ size = 24, tone = "light", withWordmark = true, gap = 8, title }: LogoProps) {
  const accent = tone === "dark" ? "#7d97ff" : theme.accent;
  const wordColor = tone === "dark" ? "#ffffff" : theme.text;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap }}>
      <LogoMark size={size} tone={tone} title={title} />
      {withWordmark && (
        <span style={{ fontWeight: 740, letterSpacing: "-0.03em", fontSize: Math.round(size * 0.72), lineHeight: 1, color: wordColor }}>
          tab<span style={{ color: accent }}>lign</span>
        </span>
      )}
    </span>
  );
}
