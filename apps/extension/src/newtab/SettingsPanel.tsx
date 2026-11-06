import type { CSSProperties } from "react";
import { Segmented, Settings, X, LOCALE_NAMES, setLocale, theme, useLocale, useT, type Locale } from "@tablign/ui";
import { ThemePanel, type ThemePanelProps } from "./ThemePanel";

const LOCALES: Locale[] = ["ko", "en"];

const groupTitle: CSSProperties = { padding: "14px 14px 2px", fontSize: 13, fontWeight: 740, color: theme.text };

/** 오른쪽 서랍의 설정 — 맨 위 언어, 그 아래 테마 */
export function SettingsPanel({ onClose, ...themeProps }: ThemePanelProps & { onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* 머리를 강조색으로 채워 설정 패널이 열린 탭과 다른 화면으로 보이게 한다 */}
      <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        background: theme.accent, color: theme.onAccent, borderBottom: "1px solid transparent" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.18)" }}>
            <Settings size={15} />
          </span>
          <strong style={{ letterSpacing: ".4px" }}>{t.settingsPanel.title}</strong>
        </span>
        <button type="button" title={t.settingsPanel.close} aria-label={t.settingsPanel.close} onClick={onClose}
          style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 2, color: "inherit", opacity: 0.75 }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 0 10px" }}>
        <div style={groupTitle}>{t.settingsPanel.language}</div>
        <section style={{ padding: "10px 14px 14px" }}>
          <Segmented items={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))} value={locale} onChange={setLocale} />
        </section>
        <div style={{ height: 1, background: theme.divider, margin: "0 14px" }} />
        <div style={groupTitle}>{t.settingsPanel.theme}</div>
        <ThemePanel {...themeProps} />
      </div>
    </div>
  );
}
