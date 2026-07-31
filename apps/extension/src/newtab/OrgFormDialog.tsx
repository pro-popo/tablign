import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { theme, Button, overlayAnimationCss, overlayIn, panelIn, ColorPicker, ColorGradientPicker } from "@tablign/ui";
import { PERSONAL_DEFAULT_ICON, PERSONAL_DEFAULT_COLOR, ORG_ICON_FONT } from "./orgIcon";
import { OrgIconBox } from "./OrgIconBox";
import { TossEmojiPicker } from "./TossEmojiPicker";
import { buildTossCategories } from "./tossEmoji";

export interface OrgFormValue { name: string; icon: string | null; color: string | null; icon_scale: number; icon_x: number; icon_y: number }
export interface OrgFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: OrgFormValue;
  /** 개인 조직 프로필 편집 — 이름 '개인' 고정, 이모지·색상·크기/위치만 편집. */
  personal?: boolean;
  onSubmit: (v: OrgFormValue) => void;
  onClose: () => void;
}

// 대표 색: 살짝 파스텔 톤 8색. 웜→쿨 순서(핑크·오렌지·옐로우 → 그린·틸·시안·블루·바이올렛).
const SWATCHES = ["#F783AC", "#FFA94D", "#FFD43B", "#69DB7C", "#38D9A9", "#66D9E8", "#748FFC", "#9775FA"];
// 조직 생성 기본 색 — 단색 스와치 첫 번째.
const DEFAULT_COLOR = SWATCHES[0];
// 그라데이션 프리셋 — 8색 휠의 인접 대표색을 이어붙인 135° 8종(웜→쿨 순환 완성). 문자열 포맷은 buildColorValue와 동일(라운드트립 시 링 유지).
const GRADIENT_PRESETS = [
  "linear-gradient(135deg, #F783AC, #FFA94D)",
  "linear-gradient(135deg, #FFA94D, #FFD43B)",
  "linear-gradient(135deg, #FFD43B, #69DB7C)",
  "linear-gradient(135deg, #69DB7C, #38D9A9)",
  "linear-gradient(135deg, #38D9A9, #66D9E8)",
  "linear-gradient(135deg, #66D9E8, #748FFC)",
  "linear-gradient(135deg, #748FFC, #9775FA)",
  "linear-gradient(135deg, #9775FA, #F783AC)",
];
const isSolid = (c: string) => c.startsWith("#");

// 아이콘 조정: 오프셋 한계(±, @100px 기준), 스케일(%) 범위.
const ICON_OFFSET_MAX = 25;
const ICON_SCALE_MIN = 0;
const ICON_SCALE_MAX = 200;
// 이모지 빠른 선택 대표 칩(색상 프리셋과 대응). 그 외는 ＋(토스 피커)에서 고른다.
const PRESET_EMOJIS = ["🚀", "💡", "🎯", "🏢", "🌱", "🎨"];
// 이모지 선택 링 색 — 대표색(#3b5bdb)의 파스텔 인디고. 색상은 자기색 링을 쓰므로 이모지에만 적용.
const EMOJI_RING = "#91A7FF";
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
// 이모지 풀 구성에 실패했을 때(테스트 목 등으로 카테고리 데이터가 없는 경우)의 최후 방어값.
const FALLBACK_ICON = "🚀";

// 생성 시 기본 아이콘 후보 — 토스 커버 범위에서, symbols·flags 제외.
const RANDOM_ICON_POOL: string[] = buildTossCategories()
  .filter((c) => c.id !== "symbols" && c.id !== "flags")
  .flatMap((c) => c.items.map((it) => it.native));

function randomIcon(): string {
  if (RANDOM_ICON_POOL.length === 0) return FALLBACK_ICON;
  return RANDOM_ICON_POOL[Math.floor(Math.random() * RANDOM_ICON_POOL.length)];
}

// 팝오버가 열릴 위치(아래/위)를 정할 때 필요한 대략적인 높이 추정치.
// 토스 피커 본문(264px) + 탭·검색·프리뷰 영역을 포함해 넉넉히 잡는다.
const EMOJI_POPOVER_HEIGHT = 380;

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

export function OrgFormDialog({ open, mode, initial, personal = false, onSubmit, onClose }: OrgFormDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(() =>
    mode === "edit" ? (initial?.icon ?? (personal ? PERSONAL_DEFAULT_ICON : randomIcon())) : randomIcon(),
  );
  const [color, setColor] = useState<string>(() =>
    mode === "edit" ? (initial?.color ?? (personal ? PERSONAL_DEFAULT_COLOR : DEFAULT_COLOR)) : DEFAULT_COLOR,
  );
  // 직접 고른 커스텀 색을 기억한다 — 프리셋을 다시 눌러도 스와치 목록에 남겨두기 위해 현재 선택(color)과 분리해서 보관.
  const [customColor, setCustomColor] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  // 열린 색 편집기: 단색(ColorPicker) · 그라데이션(ColorGradientPicker) · 없음.
  const [colorEditor, setColorEditor] = useState<"solid" | "gradient" | null>(null);
  // 직접 고른(대표 외) 이모지를 기억 — 대표 칩을 눌러도 슬롯에 남겨두기 위해 현재 아이콘과 분리 보관.
  const [customEmoji, setCustomEmoji] = useState<string | null>(null);
  // 아이콘 위치·크기 조정값(기준 박스 100px). 스케일 %, 오프셋 px.
  const [iconScale, setIconScale] = useState(100);
  const [iconX, setIconX] = useState(0);
  const [iconY, setIconY] = useState(0);
  const [emojiPlacement, setEmojiPlacement] = useState<Placement>("down");
  // 커스텀 색 편집 초안 — 편집 중엔 이 값만 바뀌고, '확인'을 눌러야 실제 color에 적용된다.
  const [colorDraft, setColorDraft] = useState<string>(DEFAULT_COLOR);

  const emojiWrapRef = useRef<HTMLDivElement>(null);
  const solidWrapRef = useRef<HTMLDivElement>(null);
  const gradWrapRef = useRef<HTMLDivElement>(null);

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

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setName(initial?.name ?? "");
      // 생성 모드는 열릴 때마다 새로운 무작위 기본 이모지를 뽑는다. 편집 모드는 기존 아이콘을 유지하되,
      // 개인 조직은 아이콘이 없으면 무작위 대신 기본 🏠를 쓴다.
      const initialIcon = mode === "edit" ? (initial?.icon ?? (personal ? PERSONAL_DEFAULT_ICON : randomIcon())) : randomIcon();
      setIcon(initialIcon);
      // 대표 칩에 없는 이모지면 커스텀 슬롯에 표시한다.
      setCustomEmoji(PRESET_EMOJIS.includes(initialIcon) ? null : initialIcon);
      const initialColor = initial?.color ?? (personal ? PERSONAL_DEFAULT_COLOR : DEFAULT_COLOR);
      setColor(initialColor);
      // 기존 색이 프리셋에 없으면 커스텀 색으로 기억해 슬롯에 표시한다.
      setCustomColor(SWATCHES.includes(initialColor) || GRADIENT_PRESETS.includes(initialColor) ? null : initialColor);
      setIconScale(initial?.icon_scale ?? 100);
      setIconX(initial?.icon_x ?? 0);
      setIconY(initial?.icon_y ?? 0);
      setEmojiOpen(false);
      setColorEditor(null);
    }
    wasOpen.current = open;
  }, [open, initial, mode, personal]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // 팝오버가 열려 있으면 팝오버만 먼저 닫는다 — 다이얼로그의 Escape 닫기는 그대로 둔다.
      // 두 팝오버가 동시에 열리는 일은 없지만(한쪽을 열면 다른 쪽을 닫음), 순서상 색상 팝오버를 먼저 확인한다.
      if (colorEditor) { setColorEditor(null); return; }
      if (emojiOpen) { setEmojiOpen(false); return; }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, emojiOpen, colorEditor, onClose]);

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
    if (!colorEditor) return;
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      const inSolid = solidWrapRef.current?.contains(t);
      const inGrad = gradWrapRef.current?.contains(t);
      if (!inSolid && !inGrad) setColorEditor(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [colorEditor]);

  if (!open) return null;

  const title = mode === "create" ? "새 조직 만들기" : "프로필 설정";
  const submitLabel = mode === "create" ? "만들기" : "저장";
  // 커스텀 색 슬롯 표시 여부는 "기억된 커스텀 색"(customColor)으로 결정한다 — 프리셋을 골라도 유지됨.
  // 선택 링은 현재 선택색이 그 커스텀 색과 같을 때만 켠다.
  // 커스텀 색은 단색·그라데이션 중 한 종류만 기억(customColor). 종류에 따라 해당 줄의 슬롯에만 표시.
  const hasCustomSolid = customColor !== null && isSolid(customColor);
  const hasCustomGradient = customColor !== null && !isSolid(customColor);
  const customSolidSelected = hasCustomSolid && color === customColor;
  const customGradientSelected = hasCustomGradient && color === customColor;

  // 커스텀 편집기 열기 — 같은 편집기가 열려 있으면 닫고, 아니면 초안(draft)을 씨앗값으로 채워 연다.
  // seed 없으면 현재 색이 해당 종류면 그 값, 아니면 기본값에서 시작.
  function openColorEditor(mode: "solid" | "gradient", seed?: string) {
    if (colorEditor === mode) { setColorEditor(null); return; }
    const start = seed ?? (mode === "solid"
      ? (isSolid(color) ? color : DEFAULT_COLOR)
      : (!isSolid(color) ? color : GRADIENT_PRESETS[0]));
    setColorDraft(start);
    setColorEditor(mode);
    setEmojiOpen(false);
  }
  // 확인 — 초안을 실제 색·커스텀 슬롯에 적용하고 팝오버를 닫는다.
  function applyColorDraft() {
    setColor(colorDraft);
    setCustomColor(colorDraft);
    setColorEditor(null);
  }
  const hasCustomEmoji = customEmoji !== null;
  const customEmojiSelected = hasCustomEmoji && icon === customEmoji;
  // 커스텀 스와치의 "직접 고른 색" 표식(프리셋 색을 이어붙인 스펙트럼). 스와치 안쪽에 배치해 크기는 그대로 둔다.
  const rainbowGradient = `conic-gradient(from 0deg, ${[...SWATCHES, SWATCHES[0]].join(", ")})`;

  // 패널 행 공용 스타일
  const rowLabel: CSSProperties = { fontSize: 10, letterSpacing: ".2px", color: "#8a929c", fontWeight: 600, marginBottom: 8 };
  const divider: CSSProperties = { borderTop: "1px solid #f1f3f5" };
  const emojiChip: CSSProperties = { width: 24, height: 24, borderRadius: 7, flex: "none", border: "1px solid rgba(0,0,0,.08)", background: "#f7f8fa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontFamily: ORG_ICON_FONT, cursor: "pointer", padding: 0, boxSizing: "border-box" };
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
      onClick={() => { if (emojiOpen) { setEmojiOpen(false); return; } if (colorEditor) { setColorEditor(null); return; } onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", animation: overlayIn, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <style>{overlayAnimationCss}</style>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        style={{ width: 340, maxWidth: "calc(100vw - 32px)", animation: panelIn, background: theme.surface, borderRadius: 12, padding: "20px 20px 16px", boxShadow: "0 12px 40px rgba(0,0,0,.22)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{title}</div>
        {/* 크기·위치 행의 고스트 −/+ : 평소 숨김, 행 호버 시 옅게 노출. */}
        <style>{".tbl-srow .tbl-b{border:none;background:none;color:#c2c8d2;width:15px;height:22px;font-size:14px;line-height:1;cursor:pointer;padding:0;opacity:0;transition:opacity .12s}.tbl-srow:hover .tbl-b{opacity:1}.tbl-srow .tbl-b:hover{color:#495057}"}</style>

        {/* 아바타(미리보기) + 이름 */}
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <OrgIconBox
            org={{ id: "preview", name, icon, color, icon_scale: iconScale, icon_x: iconX, icon_y: iconY, is_personal: personal }}
            size={44}
          />
          {personal ? (
            <span style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{name}</span>
          ) : (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="조직 이름" autoFocus
              style={{ flex: 1, padding: "9px 11px", border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          )}
        </div>

        {/* 아이콘 편집 통합 패널: 이모지 · 색상 · 크기·위치 */}
        <div style={{ marginTop: 14, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "2px 13px" }}>

          {/* 이모지 — 대표 칩 + ＋(토스 피커). 색상 행과 동일 구조. */}
          <div style={{ padding: "11px 0" }}>
            <div style={rowLabel}>이모지</div>
            <div ref={emojiWrapRef} style={{ position: "relative", display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 6 }}>
              {PRESET_EMOJIS.map((e) => (
                <button key={e} type="button" aria-label={e} onClick={() => { setIcon(e); setEmojiOpen(false); }}
                  style={icon === e ? { ...emojiChip, ...emojiChipSel } : emojiChip}>{e}</button>
              ))}
              {hasCustomEmoji ? (
                // 기억된(대표 외) 이모지 슬롯 — 클릭 = 선택, 안쪽 그리드 배지 = 토스 피커 전체 열기.
                <button type="button" aria-label={`이모지 ${customEmoji}`} onClick={() => { setIcon(customEmoji as string); setEmojiOpen(false); }}
                  style={{ position: "relative", ...(customEmojiSelected ? { ...emojiChip, ...emojiChipSel } : emojiChip) }}>
                  {customEmoji}
                  <span role="button" aria-label="이모지 전체 선택" title="이모지 전체"
                    onClick={(e) => { e.stopPropagation(); setEmojiOpen((o) => !o); setColorEditor(null); }}
                    style={{ position: "absolute", right: -3, bottom: -3, width: 12, height: 12, borderRadius: "50%", background: theme.accent,
                      boxShadow: `0 0 0 1.5px ${theme.surface}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="7" height="7" viewBox="0 0 24 24" fill="#fff"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                  </span>
                </button>
              ) : (
                <button type="button" aria-label="이모지 전체 선택" onClick={() => { setEmojiOpen((o) => !o); setColorEditor(null); }} style={plusChip}>＋</button>
              )}

              {/* 토스 피커 팝오버 — 이모지 행에 앵커. */}
              {emojiOpen && (
                <div onClick={(e) => e.stopPropagation()}
                  style={{ position: "absolute", ...(emojiPlacement === "up" ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" }),
                    left: 0, zIndex: 50, width: "fit-content", maxWidth: "calc(100vw - 48px)",
                    maxHeight: "calc(100vh - 32px)", overflow: "auto", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
                    boxShadow: "0 16px 40px rgba(0,0,0,.28)", boxSizing: "border-box" }}>
                  <TossEmojiPicker
                    onSelect={(native) => {
                      setIcon(native);
                      if (!PRESET_EMOJIS.includes(native)) setCustomEmoji(native);
                      setEmojiOpen(false);
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div style={divider} />

          {/* 색상 — 단색 줄 / 그라데이션 줄 (각 줄에 프리셋 + 커스텀 슬롯). */}
          <div style={{ padding: "11px 0" }}>
            {/* 단색 */}
            <div style={rowLabel}>단색</div>
            <div style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 6 }}>
              {SWATCHES.map((s) => (
                <button key={s} type="button" aria-label={s} onClick={() => { setColor(s); setColorEditor(null); }}
                  style={{ width: 24, height: 24, borderRadius: 7, flex: "none",
                    border: color === s ? "none" : "1px solid rgba(0,0,0,.08)",
                    boxShadow: color === s ? `0 0 0 1.5px ${theme.surface}, 0 0 0 3px ${s}` : "none",
                    background: s, cursor: "pointer", padding: 0, boxSizing: "border-box" }} />
              ))}
              {/* 단색 커스텀 슬롯 → ColorPicker */}
              <div ref={solidWrapRef} style={{ position: "relative", flex: "none", display: "flex", alignItems: "center" }}>
                {hasCustomSolid ? (
                  <button type="button" aria-label={`커스텀 색 ${customColor}`}
                    onClick={() => { setColor(customColor as string); setColorEditor(null); }}
                    style={{ position: "relative", width: 24, height: 24, borderRadius: 7, flex: "none",
                      border: `1px solid ${customSolidSelected ? "transparent" : "rgba(0,0,0,.08)"}`,
                      boxShadow: customSolidSelected ? `0 0 0 1.5px ${theme.surface}, 0 0 0 3px ${customColor}` : "none",
                      background: customColor as string, cursor: "pointer", padding: 0, boxSizing: "border-box" }}>
                    <span role="button" aria-label="커스텀 색 수정" title="색 수정"
                      onClick={(e) => { e.stopPropagation(); openColorEditor("solid", customColor as string); }}
                      style={{ position: "absolute", right: -1.5, bottom: -1.5, width: 12, height: 12, borderRadius: "50%",
                        background: rainbowGradient, boxShadow: "0 0 0 1px rgba(255,255,255,.9)", cursor: "pointer" }} />
                  </button>
                ) : (
                  <button type="button" aria-label="색상 직접 선택" onClick={() => openColorEditor("solid")}
                    style={{ width: 24, height: 24, borderRadius: 7, border: `1px dashed ${theme.textFaint}`, background: theme.surface, color: theme.textFaint,
                      cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
                    ＋
                  </button>
                )}
                {colorEditor === "solid" && (
                  <div onClick={(e) => e.stopPropagation()}
                    style={{ position: "absolute", top: "calc(100% + 8px)",
                      right: 0, zIndex: 50, width: 256, maxWidth: "calc(100vw - 48px)", background: theme.surface,
                      border: `1px solid ${theme.border}`, borderRadius: 14, padding: 14, boxShadow: "0 16px 40px rgba(0,0,0,.28)", boxSizing: "border-box" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                      <OrgIconBox org={{ id: "preview", name, icon, color: colorDraft, icon_scale: iconScale, icon_x: iconX, icon_y: iconY, is_personal: personal }} size={44} />
                    </div>
                    <ColorPicker value={colorDraft} onChange={setColorDraft} />
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                      <Button onClick={applyColorDraft}>확인</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 그라데이션 */}
            <div style={{ ...rowLabel, marginTop: 13 }}>그라데이션</div>
            <div style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 6 }}>
              {GRADIENT_PRESETS.map((g, i) => (
                <button key={g} type="button" aria-label={`그라데이션 ${i + 1}`} onClick={() => { setColor(g); setColorEditor(null); }}
                  style={{ width: 24, height: 24, borderRadius: 7, flex: "none",
                    border: color === g ? "none" : "1px solid rgba(0,0,0,.08)",
                    boxShadow: color === g ? `0 0 0 1.5px ${theme.surface}, 0 0 0 3px ${theme.accent}` : "none",
                    background: g, cursor: "pointer", padding: 0, boxSizing: "border-box" }} />
              ))}
              {/* 그라데이션 커스텀 슬롯 → ColorGradientPicker */}
              <div ref={gradWrapRef} style={{ position: "relative", flex: "none", display: "flex", alignItems: "center" }}>
                {hasCustomGradient ? (
                  <button type="button" aria-label="커스텀 그라데이션"
                    onClick={() => { setColor(customColor as string); setColorEditor(null); }}
                    style={{ position: "relative", width: 24, height: 24, borderRadius: 7, flex: "none",
                      border: `1px solid ${customGradientSelected ? "transparent" : "rgba(0,0,0,.08)"}`,
                      boxShadow: customGradientSelected ? `0 0 0 1.5px ${theme.surface}, 0 0 0 3px ${theme.accent}` : "none",
                      background: customColor as string, cursor: "pointer", padding: 0, boxSizing: "border-box" }}>
                    <span role="button" aria-label="커스텀 그라데이션 수정" title="그라데이션 수정"
                      onClick={(e) => { e.stopPropagation(); openColorEditor("gradient", customColor as string); }}
                      style={{ position: "absolute", right: -1.5, bottom: -1.5, width: 12, height: 12, borderRadius: "50%",
                        background: rainbowGradient, boxShadow: "0 0 0 1px rgba(255,255,255,.9)", cursor: "pointer" }} />
                  </button>
                ) : (
                  <button type="button" aria-label="그라데이션 직접 선택" onClick={() => openColorEditor("gradient")}
                    style={{ width: 24, height: 24, borderRadius: 7, border: `1px dashed ${theme.textFaint}`, background: theme.surface, color: theme.textFaint,
                      cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
                    ＋
                  </button>
                )}
                {colorEditor === "gradient" && (
                  <div onClick={(e) => e.stopPropagation()}
                    style={{ position: "absolute", top: "calc(100% + 8px)",
                      right: 0, zIndex: 50, width: 256, maxWidth: "calc(100vw - 48px)", background: theme.surface,
                      border: `1px solid ${theme.border}`, borderRadius: 14, padding: 14, boxShadow: "0 16px 40px rgba(0,0,0,.28)", boxSizing: "border-box" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                      <OrgIconBox org={{ id: "preview", name, icon, color: colorDraft, icon_scale: iconScale, icon_x: iconX, icon_y: iconY, is_personal: personal }} size={44} />
                    </div>
                    <ColorGradientPicker value={colorDraft} onChange={setColorDraft} />
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                      <Button onClick={applyColorDraft}>확인</Button>
                    </div>
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
