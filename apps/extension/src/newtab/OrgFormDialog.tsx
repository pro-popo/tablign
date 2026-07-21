import { useEffect, useRef, useState } from "react";
import { theme, Button, overlayAnimationCss, overlayIn, panelIn, ColorPicker } from "@tablign/ui";
import Picker from "@emoji-mart/react";
import emojiData from "@emoji-mart/data";

export interface OrgFormValue { name: string; icon: string | null; color: string | null }
export interface OrgFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: OrgFormValue;
  onSubmit: (v: OrgFormValue) => void;
  onClose: () => void;
}

// 대표 색: 이모지와 두루 어울리도록 채도를 살짝 낮춘 균형 잡힌 톤(고르게 분포된 8색).
const SWATCHES = ["#4C6EF5", "#7950F2", "#22B8CF", "#12B886", "#40C057", "#FAB005", "#FD7E14", "#F06595"];
const DEFAULT_COLOR = "#4C6EF5";
const DEFAULT_ICON = "🚀";

interface EmojiMartSelection { native?: string }

export function OrgFormDialog({ open, mode, initial, onSubmit, onClose }: OrgFormDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(DEFAULT_ICON);
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const emojiWrapRef = useRef<HTMLDivElement>(null);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setName(initial?.name ?? "");
      setIcon(initial?.icon ?? DEFAULT_ICON);
      setColor(initial?.color ?? DEFAULT_COLOR);
      setEmojiOpen(false);
      setPickerOpen(false);
    }
    wasOpen.current = open;
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // 이모지 팝오버가 열려 있으면 팝오버만 먼저 닫는다 — 다이얼로그의 Escape 닫기는 그대로 둔다.
      if (emojiOpen) { setEmojiOpen(false); return; }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, emojiOpen, onClose]);

  // 팝오버 바깥 클릭 시 닫기 (아바타 버튼 자체는 팝오버 래퍼 안에 있어 토글과 충돌하지 않는다)
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
            <button type="button" aria-label="아이콘 선택" onClick={() => setEmojiOpen((o) => !o)}
              style={{ position: "relative", width: 44, height: 44, borderRadius: 12, border: "none", padding: 0, cursor: "pointer",
                background: color, color: "#fff", fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, boxSizing: "border-box" }}>
              {icon}
              <span style={{ position: "absolute", right: -3, bottom: -3, width: 17, height: 17, borderRadius: "50%", background: theme.surface,
                border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: theme.textMuted,
                boxSizing: "border-box" }}>✎</span>
            </button>

            {/* 이모지 피커 (emoji-mart) — 아바타에 앵커된 플로팅 팝오버. 다이얼로그 본문 흐름 밖에 렌더링돼 레이아웃에 자리를 차지하지 않는다. */}
            {emojiOpen && (
              <div onClick={(e) => e.stopPropagation()}
                style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 50, width: 300, maxWidth: "calc(100vw - 64px)",
                  overflow: "hidden", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
                  boxShadow: "0 16px 40px rgba(0,0,0,.28)", boxSizing: "border-box" }}>
                <style>{"em-emoji-picker { height: 340px !important; }"}</style>
                <Picker
                  data={emojiData}
                  onEmojiSelect={(e: EmojiMartSelection) => {
                    if (e.native) setIcon(e.native);
                    setEmojiOpen(false);
                  }}
                  theme="light"
                  previewPosition="none"
                  skinTonePosition="search"
                  perLine={7}
                  maxFrequentRows={2}
                  dynamicWidth={false}
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
              style={{ width: 26, height: 26, borderRadius: 8, border: color === s ? `2px solid ${theme.text}` : "1px solid rgba(0,0,0,.08)",
                background: s, cursor: "pointer", padding: 0, boxSizing: "border-box" }} />
          ))}
          <button type="button" aria-label="색상 직접 선택" onClick={() => setPickerOpen((o) => !o)}
            style={{ width: 26, height: 26, borderRadius: 8, border: `1px dashed ${theme.textFaint}`, background: theme.surface, color: theme.textFaint,
              cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
            ＋
          </button>
        </div>

        {/* 인라인 색상 선택기 */}
        {pickerOpen && (
          <div style={{ marginTop: 12 }}>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        )}

        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={submit} disabled={!name.trim()}>{submitLabel}</Button>
        </div>
      </div>
    </div>
  );
}
