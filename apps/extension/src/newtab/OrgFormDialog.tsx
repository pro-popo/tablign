import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { theme, Button, overlayAnimationCss, overlayIn, panelIn, ColorPicker } from "@tablign/ui";
import { orgIconStyle } from "./orgIcon";
import Picker from "@emoji-mart/react";
import emojiData from "@emoji-mart/data";
import i18nAr from "@emoji-mart/data/i18n/ar.json";
import i18nBe from "@emoji-mart/data/i18n/be.json";
import i18nCs from "@emoji-mart/data/i18n/cs.json";
import i18nDe from "@emoji-mart/data/i18n/de.json";
import i18nEn from "@emoji-mart/data/i18n/en.json";
import i18nEs from "@emoji-mart/data/i18n/es.json";
import i18nFa from "@emoji-mart/data/i18n/fa.json";
import i18nFi from "@emoji-mart/data/i18n/fi.json";
import i18nFr from "@emoji-mart/data/i18n/fr.json";
import i18nHi from "@emoji-mart/data/i18n/hi.json";
import i18nIt from "@emoji-mart/data/i18n/it.json";
import i18nJa from "@emoji-mart/data/i18n/ja.json";
import i18nKo from "@emoji-mart/data/i18n/ko.json";
import i18nNl from "@emoji-mart/data/i18n/nl.json";
import i18nPl from "@emoji-mart/data/i18n/pl.json";
import i18nPt from "@emoji-mart/data/i18n/pt.json";
import i18nRu from "@emoji-mart/data/i18n/ru.json";
import i18nSa from "@emoji-mart/data/i18n/sa.json";
import i18nTr from "@emoji-mart/data/i18n/tr.json";
import i18nUk from "@emoji-mart/data/i18n/uk.json";
import i18nVi from "@emoji-mart/data/i18n/vi.json";
import i18nZh from "@emoji-mart/data/i18n/zh.json";

export interface OrgFormValue { name: string; icon: string | null; color: string | null; icon_scale: number; icon_x: number; icon_y: number }
export interface OrgFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: OrgFormValue;
  onSubmit: (v: OrgFormValue) => void;
  onClose: () => void;
}

// 대표 색: 살짝 파스텔 톤 8색. 웜→쿨 순서(핑크·오렌지·옐로우 → 그린·틸·시안·블루·바이올렛).
const SWATCHES = ["#F783AC", "#FFA94D", "#FFD43B", "#69DB7C", "#38D9A9", "#66D9E8", "#748FFC", "#9775FA"];
const DEFAULT_COLOR = "#748FFC";

// 아이콘 조정: 오프셋 한계(±, @100px 기준), 스케일(%) 범위.
const ICON_OFFSET_MAX = 25;
const ICON_SCALE_MIN = 60;
const ICON_SCALE_MAX = 140;
// 이모지 빠른 선택 대표 칩(색상 프리셋과 대응). 그 외는 ＋(emoji-mart)에서 고른다.
const PRESET_EMOJIS = ["🚀", "💡", "🎯", "🏢", "🌱", "🎨"];
// 이모지 선택 링 색 — 대표색(#3b5bdb)의 파스텔 인디고. 색상은 자기색 링을 쓰므로 이모지에만 적용.
const EMOJI_RING = "#91A7FF";
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
// 이모지 풀 구성에 실패했을 때(테스트 목 등으로 카테고리 데이터가 없는 경우)의 최후 방어값.
const FALLBACK_ICON = "🚀";

interface EmojiMartSelection { native?: string }
interface EmojiMartCategory { id: string; emojis: string[] }
interface EmojiMartEmojiEntry { skins?: { native?: string }[] }
interface EmojiMartDataShape { categories?: EmojiMartCategory[]; emojis?: Record<string, EmojiMartEmojiEntry> }

// 생성 시 무작위 기본 이모지 후보 풀 — Symbols·Flags 카테고리는 제외한다.
// 모듈 스코프에서 한 번만 구성한다.
const RANDOM_ICON_EXCLUDED_CATEGORIES = new Set(["symbols", "flags"]);
const RANDOM_ICON_POOL: string[] = (() => {
  const data = emojiData as unknown as EmojiMartDataShape;
  const pool: string[] = [];
  for (const category of data.categories ?? []) {
    if (RANDOM_ICON_EXCLUDED_CATEGORIES.has(category.id)) continue;
    for (const emojiId of category.emojis ?? []) {
      const native = data.emojis?.[emojiId]?.skins?.[0]?.native;
      if (native) pool.push(native);
    }
  }
  return pool;
})();

function randomIcon(): string {
  if (RANDOM_ICON_POOL.length === 0) return FALLBACK_ICON;
  return RANDOM_ICON_POOL[Math.floor(Math.random() * RANDOM_ICON_POOL.length)];
}

// emoji-mart Picker의 UI 문자열(검색 placeholder, 카테고리명 등) 로케일.
// CDN에서 fetch하지 않도록 @emoji-mart/data가 번들에 포함해 배포하는 i18n JSON만 사용한다(CSP 안전).
const PICKER_I18N: Record<string, unknown> = {
  ar: i18nAr, be: i18nBe, cs: i18nCs, de: i18nDe, en: i18nEn, es: i18nEs,
  fa: i18nFa, fi: i18nFi, fr: i18nFr, hi: i18nHi, it: i18nIt, ja: i18nJa,
  ko: i18nKo, nl: i18nNl, pl: i18nPl, pt: i18nPt, ru: i18nRu, sa: i18nSa,
  tr: i18nTr, uk: i18nUk, vi: i18nVi, zh: i18nZh,
};

function detectPickerLocale(): string {
  const lang = (typeof navigator !== "undefined" ? navigator.language : "en").split("-")[0].toLowerCase();
  return PICKER_I18N[lang] ? lang : "en";
}

const PICKER_LOCALE = detectPickerLocale();
const PICKER_I18N_DATA = PICKER_I18N[PICKER_LOCALE];

// 팝오버가 열릴 위치(아래/위)를 정할 때 필요한 대략적인 높이 추정치.
// 이모지 피커는 em-emoji-picker 자체를 340px로 캡핑하므로 테두리·여백을 포함해 넉넉히 잡는다.
const EMOJI_POPOVER_HEIGHT = 380;
const COLOR_POPOVER_HEIGHT = 300;

type Placement = "down" | "up";

// 트리거 래퍼 기준으로 아래 공간이 부족하고 위 공간이 더 넓으면 위로 뒤집는다.
// jsdom 등 테스트 환경에서는 getBoundingClientRect가 전부 0을 반환하므로
// spaceBelow(= innerHeight - 0)가 커져 항상 "down"으로 안전하게 귀결된다.
function computePlacement(triggerRef: React.RefObject<HTMLElement | null>, neededHeight: number): Placement {
  if (!triggerRef.current) return "down";
  const rect = triggerRef.current.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  if (spaceBelow < neededHeight && spaceAbove > spaceBelow) return "up";
  return "down";
}

export function OrgFormDialog({ open, mode, initial, onSubmit, onClose }: OrgFormDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(() => (mode === "edit" ? (initial?.icon ?? randomIcon()) : randomIcon()));
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  // 직접 고른 커스텀 색을 기억한다 — 프리셋을 다시 눌러도 스와치 목록에 남겨두기 위해 현재 선택(color)과 분리해서 보관.
  const [customColor, setCustomColor] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // 직접 고른(대표 외) 이모지를 기억 — 대표 칩을 눌러도 슬롯에 남겨두기 위해 현재 아이콘과 분리 보관.
  const [customEmoji, setCustomEmoji] = useState<string | null>(null);
  // 아이콘 위치·크기 조정값(기준 박스 100px). 스케일 %, 오프셋 px.
  const [iconScale, setIconScale] = useState(100);
  const [iconX, setIconX] = useState(0);
  const [iconY, setIconY] = useState(0);
  const [emojiPlacement, setEmojiPlacement] = useState<Placement>("down");
  const [colorPlacement, setColorPlacement] = useState<Placement>("down");

  const emojiWrapRef = useRef<HTMLDivElement>(null);
  const colorWrapRef = useRef<HTMLDivElement>(null);

  // 열릴 때 + 창 크기 변경 시 아래 공간을 다시 측정해 뒤집을지 정한다.
  useLayoutEffect(() => {
    if (!emojiOpen) return;
    function update() {
      setEmojiPlacement(computePlacement(emojiWrapRef, EMOJI_POPOVER_HEIGHT));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [emojiOpen]);

  useLayoutEffect(() => {
    if (!pickerOpen) return;
    function update() {
      setColorPlacement(computePlacement(colorWrapRef, COLOR_POPOVER_HEIGHT));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [pickerOpen]);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setName(initial?.name ?? "");
      // 생성 모드는 열릴 때마다 새로운 무작위 기본 이모지를 뽑는다. 편집 모드는 기존 아이콘을 유지한다.
      const initialIcon = mode === "edit" ? (initial?.icon ?? randomIcon()) : randomIcon();
      setIcon(initialIcon);
      // 대표 칩에 없는 이모지면 커스텀 슬롯에 표시한다.
      setCustomEmoji(PRESET_EMOJIS.includes(initialIcon) ? null : initialIcon);
      const initialColor = initial?.color ?? DEFAULT_COLOR;
      setColor(initialColor);
      // 기존 색이 프리셋에 없으면 커스텀 색으로 기억해 슬롯에 표시한다.
      setCustomColor(SWATCHES.includes(initialColor) ? null : initialColor);
      setIconScale(initial?.icon_scale ?? 100);
      setIconX(initial?.icon_x ?? 0);
      setIconY(initial?.icon_y ?? 0);
      setEmojiOpen(false);
      setPickerOpen(false);
    }
    wasOpen.current = open;
  }, [open, initial, mode]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // 팝오버가 열려 있으면 팝오버만 먼저 닫는다 — 다이얼로그의 Escape 닫기는 그대로 둔다.
      // 두 팝오버가 동시에 열리는 일은 없지만(한쪽을 열면 다른 쪽을 닫음), 순서상 색상 팝오버를 먼저 확인한다.
      if (pickerOpen) { setPickerOpen(false); return; }
      if (emojiOpen) { setEmojiOpen(false); return; }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, emojiOpen, pickerOpen, onClose]);

  // 이모지 팝오버 바깥 클릭 시 닫기 (아바타 버튼 자체는 팝오버 래퍼 안에 있어 토글과 충돌하지 않는다)
  useEffect(() => {
    if (!emojiOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (emojiWrapRef.current && !emojiWrapRef.current.contains(e.target as Node)) {
        setEmojiOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [emojiOpen]);

  // 색상 팝오버 바깥 클릭 시 닫기 (＋ 버튼 자체는 팝오버 래퍼 안에 있어 토글과 충돌하지 않는다)
  useEffect(() => {
    if (!pickerOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (colorWrapRef.current && !colorWrapRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [pickerOpen]);

  if (!open) return null;

  const title = mode === "create" ? "새 조직 만들기" : "조직 설정";
  const submitLabel = mode === "create" ? "만들기" : "저장";
  // 커스텀 색 슬롯 표시 여부는 "기억된 커스텀 색"(customColor)으로 결정한다 — 프리셋을 골라도 유지됨.
  // 선택 링은 현재 선택색이 그 커스텀 색과 같을 때만 켠다.
  const hasCustom = customColor !== null;
  const customSelected = hasCustom && color === customColor;
  const hasCustomEmoji = customEmoji !== null;
  const customEmojiSelected = hasCustomEmoji && icon === customEmoji;
  // 커스텀 스와치의 "직접 고른 색" 표식(프리셋 색을 이어붙인 스펙트럼). 스와치 안쪽에 배치해 크기는 그대로 둔다.
  const rainbowGradient = `conic-gradient(from 0deg, ${[...SWATCHES, SWATCHES[0]].join(", ")})`;

  // 패널 행 공용 스타일
  const rowLabel: CSSProperties = { fontSize: 10, letterSpacing: ".2px", color: "#8a929c", fontWeight: 600, marginBottom: 8 };
  const divider: CSSProperties = { borderTop: "1px solid #f1f3f5" };
  const emojiChip: CSSProperties = { width: 24, height: 24, borderRadius: 7, flex: "none", border: "1px solid rgba(0,0,0,.08)", background: "#f7f8fa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, cursor: "pointer", padding: 0, boxSizing: "border-box" };
  // 선택: 회색 보더 유지 + 흰 간격 1.5 + 파스텔 인디고 링(3px 지점까지). 색상 스와치 링과 같은 굵기.
  const emojiChipSel: CSSProperties = { boxShadow: `0 0 0 1.5px ${theme.surface}, 0 0 0 3px ${EMOJI_RING}` };
  const plusChip: CSSProperties = { width: 24, height: 24, borderRadius: 7, flex: "none", border: `1px dashed ${theme.textFaint}`, background: theme.surface, color: theme.textFaint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, cursor: "pointer", boxSizing: "border-box", padding: 0 };
  const sliderIcon: CSSProperties = { width: 17, height: 17, flex: "none", color: theme.textMuted, display: "flex", alignItems: "center", justifyContent: "center" };

  function submit() {
    const v = name.trim();
    if (!v) return;
    onSubmit({ name: v, icon, color, icon_scale: iconScale, icon_x: iconX, icon_y: iconY });
  }

  return (
    <div role="presentation"
      onClick={() => { if (emojiOpen) { setEmojiOpen(false); return; } if (pickerOpen) { setPickerOpen(false); return; } onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", animation: overlayIn, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <style>{overlayAnimationCss}</style>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        style={{ width: 340, maxWidth: "calc(100vw - 32px)", animation: panelIn, background: theme.surface, borderRadius: 12, padding: "20px 20px 16px", boxShadow: "0 12px 40px rgba(0,0,0,.22)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{title}</div>
        {/* 크기·위치 행의 고스트 −/+ : 평소 숨김, 행 호버 시 옅게 노출. */}
        <style>{".tbl-srow .tbl-b{border:none;background:none;color:#c2c8d2;width:15px;height:22px;font-size:14px;line-height:1;cursor:pointer;padding:0;opacity:0;transition:opacity .12s}.tbl-srow:hover .tbl-b{opacity:1}.tbl-srow .tbl-b:hover{color:#495057}"}</style>

        {/* 아바타(미리보기) + 이름 */}
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative", width: 44, height: 44, borderRadius: 12, background: color, overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 25, fontWeight: 700, flexShrink: 0, boxSizing: "border-box" }}>
            <span style={orgIconStyle({ icon_scale: iconScale, icon_x: iconX, icon_y: iconY }, 44)}>{icon}</span>
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="조직 이름" autoFocus
            style={{ flex: 1, padding: "9px 11px", border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* 아이콘 편집 통합 패널: 이모지 · 색상 · 크기·위치 */}
        <div style={{ marginTop: 14, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "2px 13px" }}>

          {/* 이모지 — 대표 칩 + ＋(emoji-mart). 색상 행과 동일 구조. */}
          <div style={{ padding: "11px 0" }}>
            <div style={rowLabel}>이모지</div>
            <div ref={emojiWrapRef} style={{ position: "relative", display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 6 }}>
              {PRESET_EMOJIS.map((e) => (
                <button key={e} type="button" aria-label={e} onClick={() => { setIcon(e); setEmojiOpen(false); }}
                  style={icon === e ? { ...emojiChip, ...emojiChipSel } : emojiChip}>{e}</button>
              ))}
              {hasCustomEmoji ? (
                // 기억된(대표 외) 이모지 슬롯 — 클릭 = 선택, 안쪽 그리드 배지 = emoji-mart 전체 열기.
                <button type="button" aria-label={`이모지 ${customEmoji}`} onClick={() => { setIcon(customEmoji as string); setEmojiOpen(false); }}
                  style={{ position: "relative", ...(customEmojiSelected ? { ...emojiChip, ...emojiChipSel } : emojiChip) }}>
                  {customEmoji}
                  <span role="button" aria-label="이모지 전체 선택" title="이모지 전체"
                    onClick={(e) => { e.stopPropagation(); setEmojiOpen((o) => !o); setPickerOpen(false); }}
                    style={{ position: "absolute", right: -3, bottom: -3, width: 12, height: 12, borderRadius: "50%", background: theme.accent,
                      boxShadow: `0 0 0 1.5px ${theme.surface}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="7" height="7" viewBox="0 0 24 24" fill="#fff"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                  </span>
                </button>
              ) : (
                <button type="button" aria-label="이모지 전체 선택" onClick={() => { setEmojiOpen((o) => !o); setPickerOpen(false); }} style={plusChip}>＋</button>
              )}

              {/* emoji-mart 팝오버 — 이모지 행에 앵커. */}
              {emojiOpen && (
                <div onClick={(e) => e.stopPropagation()}
                  style={{ position: "absolute", ...(emojiPlacement === "up" ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" }),
                    left: 0, zIndex: 50, width: "fit-content", maxWidth: "calc(100vw - 48px)",
                    maxHeight: "calc(100vh - 32px)", overflow: "auto", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
                    boxShadow: "0 16px 40px rgba(0,0,0,.28)", boxSizing: "border-box" }}>
                  <style>{"em-emoji-picker { height: 340px; }"}</style>
                  <Picker
                    data={emojiData}
                    i18n={PICKER_I18N_DATA}
                    locale={PICKER_LOCALE}
                    onEmojiSelect={(e: EmojiMartSelection) => {
                      if (e.native) { setIcon(e.native); if (!PRESET_EMOJIS.includes(e.native)) setCustomEmoji(e.native); }
                      setEmojiOpen(false);
                    }}
                    theme="light"
                    previewPosition="none"
                    skinTonePosition="search"
                    maxFrequentRows={2}
                  />
                </div>
              )}
            </div>
          </div>

          <div style={divider} />

          {/* 색상 — 프리셋 8 + 커스텀 슬롯 1. */}
          <div style={{ padding: "11px 0" }}>
            <div style={rowLabel}>색상</div>
            <div style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 6 }}>
              {SWATCHES.map((s) => (
                <button key={s} type="button" aria-label={s} onClick={() => { setColor(s); setPickerOpen(false); }}
                  style={{ width: 24, height: 24, borderRadius: 7, flex: "none",
                    border: color === s ? "none" : "1px solid rgba(0,0,0,.08)",
                    boxShadow: color === s ? `0 0 0 1.5px ${theme.surface}, 0 0 0 3px ${s}` : "none",
                    background: s, cursor: "pointer", padding: 0, boxSizing: "border-box" }} />
              ))}
              {/* 커스텀 슬롯 — 래퍼로 묶어 바깥클릭 판정에서 제외. display:flex로 baseline 여백 제거. */}
              <div ref={colorWrapRef} style={{ position: "relative", flex: "none", display: "flex", alignItems: "center" }}>
                {hasCustom ? (
                  <button type="button" aria-label={`커스텀 색 ${customColor}`}
                    onClick={() => { setColor(customColor as string); setPickerOpen(false); }}
                    style={{ position: "relative", width: 24, height: 24, borderRadius: 7, flex: "none",
                      border: `1px solid ${customSelected ? "transparent" : "rgba(0,0,0,.08)"}`,
                      boxShadow: customSelected ? `0 0 0 1.5px ${theme.surface}, 0 0 0 3px ${customColor}` : "none",
                      background: customColor as string, cursor: "pointer", padding: 0, boxSizing: "border-box" }}>
                    <span role="button" aria-label="커스텀 색 수정" title="색 수정"
                      onClick={(e) => { e.stopPropagation(); setColor(customColor as string); setPickerOpen((o) => !o); setEmojiOpen(false); }}
                      style={{ position: "absolute", right: -1.5, bottom: -1.5, width: 12, height: 12, borderRadius: "50%",
                        background: rainbowGradient, boxShadow: "0 0 0 1px rgba(255,255,255,.9)", cursor: "pointer" }} />
                  </button>
                ) : (
                  <button type="button" aria-label="색상 직접 선택" onClick={() => { setPickerOpen((o) => !o); setEmojiOpen(false); }}
                    style={{ width: 24, height: 24, borderRadius: 7, border: `1px dashed ${theme.textFaint}`, background: theme.surface, color: theme.textFaint,
                      cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
                    ＋
                  </button>
                )}
                {pickerOpen && (
                  <div onClick={(e) => e.stopPropagation()}
                    style={{ position: "absolute", ...(colorPlacement === "up" ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" }),
                      left: 0, zIndex: 50, width: 240,
                      maxWidth: "calc(100vw - 48px)", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
                      padding: 14, boxShadow: "0 16px 40px rgba(0,0,0,.28)", boxSizing: "border-box" }}>
                    <ColorPicker value={color} onChange={(c) => { setColor(c); if (!SWATCHES.includes(c)) setCustomColor(c); }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={divider} />

          {/* 크기·위치 — 아이콘 슬라이더 3개(크기/좌우/상하). */}
          <div style={{ padding: "11px 0" }}>
            <div style={{ ...rowLabel, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <span>크기·위치</span>
              <button type="button" title="초기화" aria-label="크기·위치 초기화" onClick={() => { setIconScale(100); setIconX(0); setIconY(0); }}
                style={{ border: "none", background: "none", cursor: "pointer", color: theme.textFaint, display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 400, padding: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
                초기화
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* 크기: 상자 + 대각 화살표 */}
              <div className="tbl-srow" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={sliderIcon} title="크기"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="13" width="7" height="7" rx="1.3"/><path d="M11.5 12.5L19 5"/><path d="M13.5 5H19v5.5"/></svg></span>
                <input type="range" min={ICON_SCALE_MIN} max={ICON_SCALE_MAX} value={iconScale} onChange={(e) => setIconScale(Number(e.target.value))} style={{ flex: 1, minWidth: 0 }} />
                <span style={{ display: "flex", alignItems: "center", flex: "none" }}>
                  <button type="button" className="tbl-b" aria-label="크기 감소" onClick={() => setIconScale((v) => clamp(v - 1, ICON_SCALE_MIN, ICON_SCALE_MAX))}>−</button>
                  <span style={{ minWidth: 34, textAlign: "center", fontSize: 10.5, color: theme.text, fontVariantNumeric: "tabular-nums" }}>{iconScale}%</span>
                  <button type="button" className="tbl-b" aria-label="크기 증가" onClick={() => setIconScale((v) => clamp(v + 1, ICON_SCALE_MIN, ICON_SCALE_MAX))}>+</button>
                </span>
              </div>
              {/* 좌우: 원 + 뻗는 화살표(안2) */}
              <div className="tbl-srow" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={sliderIcon} title="좌우"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M8.6 12H3"/><path d="M5.5 9.5L3 12l2.5 2.5"/><path d="M15.4 12H21"/><path d="M18.5 9.5L21 12l-2.5 2.5"/></svg></span>
                <input type="range" min={-ICON_OFFSET_MAX} max={ICON_OFFSET_MAX} value={iconX} onChange={(e) => setIconX(Number(e.target.value))} style={{ flex: 1, minWidth: 0 }} />
                <span style={{ display: "flex", alignItems: "center", flex: "none" }}>
                  <button type="button" className="tbl-b" aria-label="좌우 감소" onClick={() => setIconX((v) => clamp(v - 1, -ICON_OFFSET_MAX, ICON_OFFSET_MAX))}>−</button>
                  <span style={{ minWidth: 34, textAlign: "center", fontSize: 10.5, color: theme.text, fontVariantNumeric: "tabular-nums" }}>{iconX}</span>
                  <button type="button" className="tbl-b" aria-label="좌우 증가" onClick={() => setIconX((v) => clamp(v + 1, -ICON_OFFSET_MAX, ICON_OFFSET_MAX))}>+</button>
                </span>
              </div>
              {/* 상하: 원 + 뻗는 화살표(안2) */}
              <div className="tbl-srow" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={sliderIcon} title="상하"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 8.6V3"/><path d="M9.5 5.5L12 3l2.5 2.5"/><path d="M12 15.4V21"/><path d="M9.5 18.5L12 21l2.5-2.5"/></svg></span>
                <input type="range" min={-ICON_OFFSET_MAX} max={ICON_OFFSET_MAX} value={iconY} onChange={(e) => setIconY(Number(e.target.value))} style={{ flex: 1, minWidth: 0 }} />
                <span style={{ display: "flex", alignItems: "center", flex: "none" }}>
                  <button type="button" className="tbl-b" aria-label="상하 감소" onClick={() => setIconY((v) => clamp(v - 1, -ICON_OFFSET_MAX, ICON_OFFSET_MAX))}>−</button>
                  <span style={{ minWidth: 34, textAlign: "center", fontSize: 10.5, color: theme.text, fontVariantNumeric: "tabular-nums" }}>{iconY}</span>
                  <button type="button" className="tbl-b" aria-label="상하 증가" onClick={() => setIconY((v) => clamp(v + 1, -ICON_OFFSET_MAX, ICON_OFFSET_MAX))}>+</button>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={submit} disabled={!name.trim()}>{submitLabel}</Button>
        </div>
      </div>
    </div>
  );
}
