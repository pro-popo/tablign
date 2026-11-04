import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SwatchRow, Segmented, GradientEditor, selectRing, Sun, Moon, Monitor, X, Upload, Palette, normalizeHex, theme, type ThemeGradient } from "@tablign/ui";
import {
  ACCENT_PRESETS, DEFAULT_THEME, SOLID_QUICK, GRADIENT_QUICK, SAMPLE_PHOTOS, accentHex,
  type ThemeMode, type ThemeSettings, type BackgroundKind, type PhotoSource,
} from "../lib/themeSettings";
import type { UploadState } from "../lib/useThemeSettings";

export interface ThemePanelProps {
  settings: ThemeSettings;
  onChange: (fn: (s: ThemeSettings) => ThemeSettings) => void;
  /** 닫으면 열린 탭 패널로 돌아간다 */
  onClose: () => void;
  /** 끄는 동안(그라데이션 점·슬라이더) 저장하지 않고 화면에만 그린다 */
  onPreview?: (s: ThemeSettings) => void;
  /** 화면 크기(px) — 그라데이션 미리보기를 화면과 같은 모양으로 */
  viewport?: [number, number];
  /** 올린 사진을 그릴 주소(내려받은 뒤) */
  uploadUrl?: string | null;
  uploadState?: UploadState;
  onUpload?: (file: File) => void;
}

const MODES: { mode: ThemeMode; label: string; icon: ReactNode }[] = [
  { mode: "light", label: "라이트", icon: <Sun size={13} /> },
  { mode: "dark", label: "다크", icon: <Moon size={13} /> },
  { mode: "system", label: "시스템", icon: <Monitor size={13} /> },
];
const KINDS: { value: BackgroundKind; label: string }[] = [
  { value: "none", label: "없음" }, { value: "solid", label: "단색" }, { value: "gradient", label: "그라데이션" }, { value: "photo", label: "사진" },
];

const sectionLabel: CSSProperties = { fontSize: 11.5, fontWeight: 700, color: theme.textMuted, marginBottom: 8 };
const section: CSSProperties = { padding: "10px 14px" };

export function ThemePanel({ settings, onChange, onClose, onPreview, viewport = [1440, 900], uploadUrl = null, uploadState = "idle", onUpload }: ThemePanelProps) {
  const accent = accentHex(settings);
  const accentName = "custom" in settings.accent ? "직접 고른 색" : ACCENT_PRESETS[settings.accent.preset].name;
  const bg = settings.background;
  const pickAccent = (hex: string) => {
    const i = ACCENT_PRESETS.findIndex((p) => p.hex === normalizeHex(hex));
    onChange((s) => ({ ...s, accent: i >= 0 ? { preset: i } : { custom: hex } }));
  };
  const setBg = (patch: Partial<ThemeSettings["background"]>) => onChange((s) => ({ ...s, background: { ...s.background, ...patch } }));
  const withBg = (patch: Partial<ThemeSettings["background"]>): ThemeSettings => ({ ...settings, background: { ...settings.background, ...patch } });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* 머리를 강조색으로 채워 테마 패널이 열린 탭과 다른 화면으로 보이게 한다 */}
      <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        background: theme.accent, color: theme.onAccent, borderBottom: "1px solid transparent" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.18)" }}>
            <Palette size={15} />
          </span>
          <strong style={{ letterSpacing: ".4px" }}>테마</strong>
        </span>
        <button type="button" title="테마 닫기" aria-label="테마 닫기" onClick={onClose}
          style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 2, color: "inherit", opacity: 0.75 }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "4px 0 10px" }}>
        <section style={section}>
          <div style={sectionLabel}>모드</div>
          <Segmented items={MODES.map((m) => ({ value: m.mode, label: m.label, icon: m.icon }))} value={settings.mode}
            onChange={(mode) => onChange((s) => ({ ...s, mode }))} />
        </section>
        <section style={section}>
          <div style={sectionLabel}>강조색<em style={{ fontStyle: "normal", fontWeight: 500, color: theme.textFaint, marginLeft: 6 }}>{accentName}</em></div>
          <SwatchRow shape="circle" columns={5} colors={ACCENT_PRESETS.map((p) => p.hex)} labels={ACCENT_PRESETS.map((p) => p.name)}
            value={accent} customSelected={"custom" in settings.accent} onChange={pickAccent} />
        </section>
        <section style={section}>
          <div style={sectionLabel}>배경</div>
          <Segmented small items={KINDS} value={bg.kind} onChange={(kind) => setBg({ kind })} />
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
            <RangeRow label="투명도" value={settings.glass} max={80}
              onPreview={(glass) => onPreview?.({ ...settings, glass })} onCommit={(glass) => onChange((s) => ({ ...s, glass }))} />
          )}
        </section>
      </div>
      <div style={{ flex: "none", padding: "10px 14px", borderTop: `1px solid ${theme.border}` }}>
        <button type="button" onClick={() => onChange(() => DEFAULT_THEME)}
          style={{ border: "none", background: "none", padding: 0, fontFamily: "inherit", fontSize: 12, color: theme.textMuted, cursor: "pointer" }}>
          기본으로 되돌리기
        </button>
      </div>
    </div>
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
          <button key={k} type="button" aria-label={SAMPLE_PHOTOS[k].name} aria-pressed={photo.source === k} title={SAMPLE_PHOTOS[k].name}
            onClick={() => onPick(k)} style={tile(`url("${SAMPLE_PHOTOS[k].url}") center / cover`, photo.source === k)} />
        ))}
        <button type="button" aria-label={hasUpload ? "올린 사진" : "사진 올리기"} aria-pressed={uploadOn} aria-busy={uploadState === "uploading"}
          title={uploadOn ? "다른 사진 올리기" : hasUpload ? "올린 사진" : "사진 올리기"} onClick={onUploadTile} disabled={!onUpload}
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
      <RangeRow label="덮개" value={photo.veil} max={80} onPreview={(v) => onVeil(v, false)} onCommit={(v) => onVeil(v, true)} />
    </>
  );
}
