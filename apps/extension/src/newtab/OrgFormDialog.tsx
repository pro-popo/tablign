import { useEffect, useState } from "react";
import { theme, Button, overlayAnimationCss, overlayIn, panelIn, ColorPicker } from "@tablign/ui";

export interface OrgFormValue { name: string; icon: string | null; color: string | null }
export interface OrgFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: OrgFormValue;
  onSubmit: (v: OrgFormValue) => void;
  onClose: () => void;
}

const EMOJIS = ["🙂", "🚀", "💡", "🎨", "📚", "🏢", "⭐", "🔥", "✅", "📌", "🧩", "🎯", "🌱", "🏷"];
const SWATCHES = ["#E03131", "#F59F00", "#2F9E44", "#0CA678", "#1C7ED6", "#4263EB", "#7048E8", "#E64980"];
const DEFAULT_COLOR = "#4263EB";

export function OrgFormDialog({ open, mode, initial, onSubmit, onClose }: OrgFormDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setIcon(initial?.icon ?? null);
    setColor(initial?.color ?? DEFAULT_COLOR);
    setEmojiOpen(false);
    setPickerOpen(false);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const title = mode === "create" ? "새 조직 만들기" : "조직 설정";
  const submitLabel = mode === "create" ? "만들기" : "저장";
  const avatarContent = icon ?? (name.trim()[0]?.toUpperCase() ?? "?");

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
          <button type="button" aria-label="아이콘 선택" onClick={() => setEmojiOpen((o) => !o)}
            style={{ position: "relative", width: 56, height: 56, borderRadius: 15, border: "none", padding: 0, cursor: "pointer",
              background: color, color: "#fff", fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, boxSizing: "border-box" }}>
            {avatarContent}
            <span style={{ position: "absolute", right: -3, bottom: -3, width: 20, height: 20, borderRadius: "50%", background: theme.surface,
              border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: theme.textMuted,
              boxSizing: "border-box" }}>✎</span>
          </button>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="조직 이름" autoFocus
            style={{ flex: 1, padding: "9px 11px", border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* 이모지 그리드 */}
        {emojiOpen && (
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => { setIcon(e); setEmojiOpen(false); }}
                style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface, cursor: "pointer",
                  fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
                {e}
              </button>
            ))}
            <button type="button" onClick={() => { setIcon(null); setEmojiOpen(false); }} title="이니셜로"
              style={{ gridColumn: "span 7", marginTop: 2, padding: "6px 0", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface,
                cursor: "pointer", fontSize: 12, color: theme.textMuted, boxSizing: "border-box" }}>
              이니셜로
            </button>
          </div>
        )}

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
