import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { theme, Button, overlayAnimationCss, overlayIn, panelIn, ColorPicker } from "@tablign/ui";
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

export interface OrgFormValue { name: string; icon: string | null; color: string | null }
export interface OrgFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: OrgFormValue;
  onSubmit: (v: OrgFormValue) => void;
  onClose: () => void;
}

// 대표 색: 이모지(쨍한 색감)와 어울리도록 살짝 파스텔 톤으로 낮춘 8색(고르게 분포).
const SWATCHES = ["#748FFC", "#9775FA", "#66D9E8", "#38D9A9", "#69DB7C", "#FFD43B", "#FFA94D", "#F783AC"];
const DEFAULT_COLOR = "#748FFC";
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
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
      setIcon(mode === "edit" ? (initial?.icon ?? randomIcon()) : randomIcon());
      setColor(initial?.color ?? DEFAULT_COLOR);
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

  function submit() {
    const v = name.trim();
    if (!v) return;
    onSubmit({ name: v, icon, color });
  }

  return (
    <div role="presentation" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", animation: overlayIn, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <style>{overlayAnimationCss}</style>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        style={{ width: 340, maxWidth: "calc(100vw - 32px)", animation: panelIn, background: theme.surface, borderRadius: 12, padding: "20px 20px 16px", boxShadow: "0 12px 40px rgba(0,0,0,.22)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{title}</div>

        {/* 아바타 + 이름 */}
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <div ref={emojiWrapRef} style={{ position: "relative", flexShrink: 0 }}>
            <button type="button" aria-label="아이콘 선택" onClick={() => { setEmojiOpen((o) => !o); setPickerOpen(false); }}
              style={{ position: "relative", width: 44, height: 44, borderRadius: 12, border: "none", padding: 0, cursor: "pointer",
                background: color, color: "#fff", fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, boxSizing: "border-box" }}>
              {icon}
              <span style={{ position: "absolute", right: -3, bottom: -3, width: 17, height: 17, borderRadius: "50%", background: theme.surface,
                border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: theme.textMuted,
                boxSizing: "border-box" }}>✎</span>
            </button>

            {/* 이모지 피커 (emoji-mart) — 아바타에 앵커된 플로팅 팝오버. 다이얼로그 본문 흐름 밖에 렌더링돼 레이아웃에 자리를 차지하지 않는다.
                크기는 피커의 자연 크기를 그대로 따른다(hug) — 우측/하단에 빈 여백이 남지 않도록 폭·높이를 강제하지 않는다. */}
            {emojiOpen && (
              <div onClick={(e) => e.stopPropagation()}
                style={{ position: "absolute", ...(emojiPlacement === "up" ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" }),
                  left: 0, zIndex: 50, width: "fit-content", maxWidth: "calc(100vw - 32px)",
                  maxHeight: "calc(100vh - 32px)", overflow: "auto", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
                  boxShadow: "0 16px 40px rgba(0,0,0,.28)", boxSizing: "border-box" }}>
                {/* em-emoji-picker의 자연 높이(~435px)가 화면을 넘지 않도록 고정 높이로 캡핑 — 내부 이모지 그리드가 스크롤된다. */}
                <style>{"em-emoji-picker { height: 340px; }"}</style>
                <Picker
                  data={emojiData}
                  i18n={PICKER_I18N_DATA}
                  locale={PICKER_LOCALE}
                  onEmojiSelect={(e: EmojiMartSelection) => {
                    if (e.native) setIcon(e.native);
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
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="조직 이름" autoFocus
            style={{ flex: 1, padding: "9px 11px", border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* 색상 스와치 */}
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SWATCHES.map((s) => (
            <button key={s} type="button" aria-label={s} onClick={() => { setColor(s); setPickerOpen(false); }}
              style={{ width: 26, height: 26, borderRadius: 8,
                // 선택: 흰 간격 + 그 스와치 자기 색 링(레일 활성 아이콘과 통일). 비선택: 은은한 테두리.
                border: color === s ? "none" : "1px solid rgba(0,0,0,.08)",
                boxShadow: color === s ? `0 0 0 2px ${theme.surface}, 0 0 0 4px ${s}` : "none",
                background: s, cursor: "pointer", padding: 0, boxSizing: "border-box" }} />
          ))}
          <div ref={colorWrapRef} style={{ position: "relative" }}>
            <button type="button" aria-label="색상 직접 선택" onClick={() => { setPickerOpen((o) => !o); setEmojiOpen(false); }}
              style={{ width: 26, height: 26, borderRadius: 8, border: `1px dashed ${theme.textFaint}`, background: theme.surface, color: theme.textFaint,
                cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
              ＋
            </button>

            {/* 색상 직접 선택기 — ＋ 버튼에 앵커된 플로팅 팝오버(이모지 팝오버와 동일 패턴). 다이얼로그 본문 흐름을 밀어내지 않는다. */}
            {pickerOpen && (
              <div onClick={(e) => e.stopPropagation()}
                style={{ position: "absolute", ...(colorPlacement === "up" ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" }),
                  left: 0, zIndex: 50, width: 240,
                  maxWidth: "calc(100vw - 32px)", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
                  padding: 14, boxShadow: "0 16px 40px rgba(0,0,0,.28)", boxSizing: "border-box" }}>
                <ColorPicker value={color} onChange={setColor} />
              </div>
            )}
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
