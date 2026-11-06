import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SwatchRow, Segmented, GradientEditor, selectRing, Sun, Moon, Monitor, Upload, normalizeHex, theme, useT, type ThemeGradient } from "@tablign/ui";
import {
  ACCENT_PRESETS, DEFAULT_THEME, SOLID_QUICK, GRADIENT_QUICK, SAMPLE_PHOTOS, accentHex,
  type ThemeMode, type ThemeSettings, type BackgroundKind, type PhotoSource,
} from "../lib/themeSettings";
import type { UploadState } from "../lib/useThemeSettings";

export interface ThemePanelProps {
  settings: ThemeSettings;
  onChange: (fn: (s: ThemeSettings) => ThemeSettings) => void;
  /** 끄는 동안(그라데이션 점·슬라이더) 저장하지 않고 화면에만 그린다 */
  onPreview?: (s: ThemeSettings) => void;
  /** 화면 크기(px) — 그라데이션 미리보기를 화면과 같은 모양으로 */
  viewport?: [number, number];
  /** 올린 사진을 그릴 주소(내려받은 뒤) */
  uploadUrl?: string | null;
  uploadState?: UploadState;
  onUpload?: (file: File) => void;
}

// 이름표는 그릴 때 사전에서 — 언어를 바꾸면 바로 바뀌어야 한다
const MODES: { mode: ThemeMode; icon: ReactNode }[] = [
  { mode: "light", icon: <Sun size={13} /> },
  { mode: "dark", icon: <Moon size={13} /> },
  { mode: "system", icon: <Monitor size={13} /> },
];
const KINDS: BackgroundKind[] = ["none", "solid", "gradient", "photo"];

const sectionLabel: CSSProperties = { fontSize: 11.5, fontWeight: 700, color: theme.textMuted, marginBottom: 8 };
const section: CSSProperties = { padding: "10px 14px" };

/** 설정 패널의 테마 묶음 — 머리·스크롤은 SettingsPanel이 맡는다. 되돌리기는 테마만 되돌리므로 이 묶음 안에 둔다 */
export function ThemePanel({ settings, onChange, onPreview, viewport = [1440, 900], uploadUrl = null, uploadState = "idle", onUpload }: ThemePanelProps) {
  const t = useT();
  const accent = accentHex(settings);
  const accentName = "custom" in settings.accent ? t.themePanel.customAccent : t.themeSettings.accents[settings.accent.preset];
  const bg = settings.background;
  const pickAccent = (hex: string) => {
    const i = ACCENT_PRESETS.findIndex((p) => p.hex === normalizeHex(hex));
    onChange((s) => ({ ...s, accent: i >= 0 ? { preset: i } : { custom: hex } }));
  };
  const setBg = (patch: Partial<ThemeSettings["background"]>) => onChange((s) => ({ ...s, background: { ...s.background, ...patch } }));
  const withBg = (patch: Partial<ThemeSettings["background"]>): ThemeSettings => ({ ...settings, background: { ...settings.background, ...patch } });

  return (
    <>
        <section style={section}>
          <div style={sectionLabel}>{t.themePanel.mode}</div>
          <Segmented items={MODES.map((m) => ({ value: m.mode, label: t.themePanel.modes[m.mode], icon: m.icon }))} value={settings.mode}
            onChange={(mode) => onChange((s) => ({ ...s, mode }))} />
        </section>
        <section style={section}>
          <div style={sectionLabel}>{t.themePanel.accent}<em style={{ fontStyle: "normal", fontWeight: 500, color: theme.textFaint, marginLeft: 6 }}>{accentName}</em></div>
          <SwatchRow shape="circle" columns={5} colors={ACCENT_PRESETS.map((p) => p.hex)} labels={t.themeSettings.accents}
            value={accent} customSelected={"custom" in settings.accent} onChange={pickAccent} />
        </section>
        <section style={section}>
          <div style={sectionLabel}>{t.themePanel.background}</div>
          <Segmented small items={KINDS.map((k) => ({ value: k, label: t.themePanel.kinds[k] }))} value={bg.kind} onChange={(kind) => setBg({ kind })} />
          <div style={{ marginTop: 12 }}>
            {bg.kind === "solid" && (
              <SwatchRow colors={SOLID_QUICK} value={bg.solid} onChange={(solid) => setBg({ solid })} columns={SOLID_QUICK.length + 1} />
            )}
            {bg.kind === "gradient" && (
              <GradientEditor value={bg.gradient} quickColors={GRADIENT_QUICK} viewport={viewport}
                onChange={(gradient: ThemeGradient) => setBg({ gradient })}
                onPreview={(gradient) => onPreview?.(withBg({ gradient }))} />
            )}
            {bg.kind === "photo" && (
              <PhotoPicker photo={bg.photo} uploadUrl={uploadUrl} uploadState={uploadState} onUpload={onUpload}
                onPick={(source) => setBg({ photo: { ...bg.photo, source } })}
                onVeil={(veil, commit) => (commit ? setBg({ photo: { ...bg.photo, veil } }) : onPreview?.(withBg({ photo: { ...bg.photo, veil } })))} />
            )}
          </div>
          {bg.kind !== "none" && (
            <RangeRow label={t.themePanel.glass} value={settings.glass} max={80}
              onPreview={(glass) => onPreview?.({ ...settings, glass })} onCommit={(glass) => onChange((s) => ({ ...s, glass }))} />
          )}
        </section>
        <button type="button" onClick={() => onChange(() => DEFAULT_THEME)}
          style={{ border: "none", background: "none", padding: "6px 14px 12px", fontFamily: "inherit", fontSize: 12, color: theme.textMuted, cursor: "pointer" }}>
          {t.themePanel.reset}
        </button>
    </>
  );
}

/** 끄는 동안엔 미리 보기만, 놓으면(change) 저장 */
function RangeRow({ label, value, max, onPreview, onCommit }: {
  label: string; value: number; max: number; onPreview: (v: number) => void; onCommit: (v: number) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const ref = useRef<HTMLInputElement>(null);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  useEffect(() => {
    const el = ref.current!;
    const on = () => commit.current(+el.value);
    el.addEventListener("change", on);
    return () => el.removeEventListener("change", on);
  }, []);
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, fontSize: 12, color: theme.textMuted }}>
      <span style={{ flex: "none" }}>{label}</span>
      <input ref={ref} type="range" min={0} max={max} value={v} aria-label={label}
        onChange={(e) => { const n = +e.target.value; setV(n); onPreview(n); }}
        style={{ flex: 1, minWidth: 0, accentColor: theme.accent }} />
      <span style={{ width: 24, textAlign: "right", fontVariantNumeric: "tabular-nums", color: theme.textFaint }}>{v}</span>
    </label>
  );
}

function PhotoPicker({ photo, uploadUrl, uploadState, onUpload, onPick, onVeil }: {
  photo: ThemeSettings["background"]["photo"]; uploadUrl: string | null; uploadState: UploadState;
  onUpload?: (file: File) => void; onPick: (source: PhotoSource) => void; onVeil: (veil: number, commit: boolean) => void;
}) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const tile = (bg: string, on: boolean): CSSProperties => ({
    aspectRatio: "4 / 3", width: "100%", border: "none", borderRadius: 8, padding: 0, cursor: "pointer", boxSizing: "border-box",
    background: bg, boxShadow: on ? selectRing : `inset 0 0 0 1px ${theme.border}`,
  });
  const hasUpload = !!photo.path;
  const uploadOn = photo.source === "upload" && hasUpload;
  // 올린 사진이 있고 고르지 않은 상태면 누르면 그 사진을 고른다. 고른 상태(또는 없음)면 새로 올린다.
  const onUploadTile = () => (hasUpload && !uploadOn ? onPick("upload") : fileRef.current?.click());
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {(Object.keys(SAMPLE_PHOTOS) as Exclude<PhotoSource, "upload">[]).map((k) => (
          <button key={k} type="button" aria-label={t.themeSettings.photos[k]} aria-pressed={photo.source === k} title={t.themeSettings.photos[k]}
            onClick={() => onPick(k)} style={tile(`url("${SAMPLE_PHOTOS[k].url}") center / cover`, photo.source === k)} />
        ))}
        <button type="button" aria-label={hasUpload ? t.themePanel.uploadedPhoto : t.themePanel.uploadPhoto} aria-pressed={uploadOn} aria-busy={uploadState === "uploading"}
          title={uploadOn ? t.themePanel.uploadAnotherPhoto : hasUpload ? t.themePanel.uploadedPhoto : t.themePanel.uploadPhoto} onClick={onUploadTile} disabled={!onUpload}
          style={{
            ...tile(uploadUrl ? `url("${uploadUrl}") center / cover` : theme.surface2, uploadOn),
            display: "flex", alignItems: "center", justifyContent: "center", color: theme.textFaint,
            opacity: uploadState === "uploading" ? 0.5 : 1,
            ...(uploadState === "error" ? { boxShadow: `inset 0 0 0 1.5px ${theme.danger}`, color: theme.danger } : {}),
          }}>
          {!uploadUrl && <Upload size={16} />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden data-testid="photo-file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload?.(f); e.target.value = ""; }} />
      </div>
      <RangeRow label={t.themePanel.veil} value={photo.veil} max={80} onPreview={(v) => onVeil(v, false)} onCommit={(v) => onVeil(v, true)} />
    </>
  );
}
