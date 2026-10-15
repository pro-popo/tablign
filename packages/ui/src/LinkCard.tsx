import { useEffect, useRef, useState } from "react";
import type { Link } from "@tablign/core";
import { Favicon } from "./Favicon";
import { Pencil, Trash2 } from "./icons";
import { theme } from "./theme";
import { overlayAnimationCss, popIn } from "./overlayAnimation";

export interface LinkCardProps {
  link: Link;
  onOpen: (url: string) => void;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, patch: { custom_title: string | null; url: string; note: string | null }) => void;
  /** 드래그가 진행 중이면 hover 액션 아이콘을 숨긴다 */
  dragging?: boolean;
  /** viewer 등 읽기 전용 모드: 삭제·편집 버튼을 렌더하지 않는다 */
  readOnly?: boolean;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const actionBtn: React.CSSProperties = {
  border: "none", background: theme.surface2, borderRadius: 6, padding: 4, cursor: "pointer", display: "flex",
};

/** 편집 팝오버 크기. 높이는 행 3개 + 하단 버튼으로 고정이라 화면 밖으로 넘칠지 판단할 때 쓴다. */
const POP_W = 330;
const POP_H = 180;
const POP_GAP = 8;

type Field = "title" | "note" | "url";
const FIELDS: Field[] = ["title", "note", "url"];
const ROW_H = 40;

const EASE = ".2s cubic-bezier(.2,.8,.3,1)";

export function LinkCard({ link, onOpen, onDelete, onUpdate, dragging, readOnly }: LinkCardProps) {
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const showActions = hover && !dragging && !editing;
  const [title, setTitle] = useState(link.custom_title ?? link.title ?? "");
  const [url, setUrl] = useState(link.url);
  const [note, setNote] = useState(link.note ?? domainOf(link.url));
  const [focused, setFocused] = useState<Field | null>("title");
  // 포커스 하이라이트는 행마다 켜고 끄지 않고 하나를 옮긴다 — 행 사이를 미끄러지듯 넘어간다.
  // 포커스가 빠져도 마지막 행 자리에서 흐려지기만 하도록 위치(행 번호)를 따로 둔다.
  const [hlRow, setHlRow] = useState(0);
  // 화면 오른쪽·아래쪽 카드는 팝오버를 카드 오른쪽에 맞추거나 위로 뒤집어 띄운다.
  const [place, setPlace] = useState({ above: false, alignRight: false });
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const label = link.custom_title ?? link.title ?? domainOf(link.url);

  // 바깥 클릭이면 취소. 카드 본문 클릭은 바깥으로 치지 않는다(편집 중 카드 클릭으로 링크가 열리지 않게).
  useEffect(() => {
    if (!editing) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setEditing(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [editing]);

  // 자동 포커스는 커서를 끝에 둬서 긴 제목의 앞부분이 잘려 보인다 — 맨 앞으로 되돌린다.
  useEffect(() => {
    const el = titleRef.current;
    if (!editing || !el) return;
    el.setSelectionRange(0, 0);
    el.scrollLeft = 0;
  }, [editing]);

  function openEdit() {
    // 편집 열 때마다 현재 값으로 채운다.
    setTitle(link.custom_title ?? link.title ?? "");
    setUrl(link.url);
    // 메모가 비어 있으면 부제에 보이는 도메인을 그대로 채워 둔다.
    setNote(link.note ?? domainOf(link.url));
    setFocused("title");
    setHlRow(0);
    const r = rootRef.current?.getBoundingClientRect();
    if (r) {
      setPlace({
        above: r.bottom + POP_GAP + POP_H > window.innerHeight && r.top - POP_GAP - POP_H > 0,
        alignRight: r.left + POP_W > window.innerWidth,
      });
    }
    setEditing(true);
  }

  function save() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    // 채워 둔 도메인을 그대로 두면 메모로 저장하지 않는다 — URL이 바뀌어도 부제가 새 도메인을 따라간다.
    const trimmedNote = note.trim();
    onUpdate?.(link.id, {
      custom_title: title.trim() || null,
      url: trimmedUrl,
      note: trimmedNote && trimmedNote !== domainOf(link.url) ? trimmedNote : null,
    });
    setEditing(false);
  }

  function row(field: Field, text: string, value: string, set: (v: string) => void) {
    const on = focused === field;
    return (
      <label style={{
        position: "relative", display: "grid", gridTemplateColumns: "38px 1fr", alignItems: "center", gap: 6, padding: "0 14px",
        height: ROW_H, boxSizing: "border-box", borderBottom: `1px solid ${theme.border}`, cursor: "text",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: on ? theme.accent : theme.textFaint, transition: `color ${EASE}` }}>{text}</span>
        <input
          ref={field === "title" ? titleRef : undefined}
          value={value}
          autoFocus={field === "title"}
          onChange={(e) => set(e.target.value)}
          onFocus={() => { setFocused(field); setHlRow(FIELDS.indexOf(field)); }}
          onBlur={() => setFocused((f) => (f === field ? null : f))}
          style={{
            border: "none", background: "transparent", outline: "none", padding: 0, width: "100%", minWidth: 0,
            fontSize: 12.5, color: theme.text,
          }}
        />
      </label>
    );
  }

  const arrowOn = !place.above && focused === "title";

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => { if (!editing) onOpen(link.url); }}
      style={{
        position: "relative", background: theme.surface, borderRadius: theme.radiusCard, padding: "10px 11px", cursor: editing ? "default" : "pointer",
        border: `1px solid ${editing ? theme.accent : theme.borderCard}`, boxShadow: editing ? `0 0 0 3px ${theme.accentWeak}` : "0 0 0 0 transparent",
        transition: `border-color ${EASE}, box-shadow ${EASE}`,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
        <Favicon url={link.favicon_url} />
        <span style={{ fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
      </div>
      {(() => {
        // 부제는 항상 한 줄로 고정(카드 높이 통일). 메모가 곧 링크 정보 — 메모가 없으면 도메인.
        // 제목 자리에 이미 도메인이 보이면 부제는 비운다(같은 글자 두 번 방지).
        const dom = domainOf(link.url);
        const sub = link.note || (label !== dom ? dom : "");
        return (
          <div style={{ color: theme.textFaint, fontSize: 11, marginTop: 5, height: 14, lineHeight: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sub}
          </div>
        );
      })()}
      {!readOnly && (
        <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 2, opacity: showActions ? 1 : 0, pointerEvents: showActions ? "auto" : "none", transition: "opacity .12s" }}>
          {onUpdate && (
            <button type="button" title="편집" aria-label="편집" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); openEdit(); }} style={actionBtn}>
              <Pencil size={14} color={theme.textMuted} />
            </button>
          )}
          <button type="button" title="삭제" aria-label="삭제" onClick={(e) => { e.stopPropagation(); onDelete(link.id); }} style={actionBtn}>
            <Trash2 size={14} color={theme.danger} />
          </button>
        </div>
      )}
      {editing && (
        <div
          role="dialog"
          aria-label="링크 편집"
          // 드래그 시작·키 입력이 카드(정렬 래퍼)로 번지지 않게 막는다.
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            // Enter 저장은 입력칸에서만 — 취소 버튼에 포커스가 있을 때 Enter가 저장이 되면 안 된다.
            if (e.key === "Enter" && e.target instanceof HTMLInputElement) save();
            else if (e.key === "Escape") setEditing(false);
          }}
          style={{
            position: "absolute", zIndex: 50, width: POP_W, boxSizing: "border-box", cursor: "default",
            ...(place.above ? { bottom: `calc(100% + ${POP_GAP}px)` } : { top: `calc(100% + ${POP_GAP}px)` }),
            ...(place.alignRight ? { right: -1 } : { left: -1 }),
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12,
            boxShadow: "0 12px 32px rgba(20,30,60,.16)",
            animation: popIn,
            transformOrigin: `${place.alignRight ? "calc(100% - 27px)" : "27px"} ${place.above ? "100%" : "0"}`,
          }}
        >
          <style>{overlayAnimationCss}</style>
          {/* 카드를 가리키는 꼬리. 위쪽 꼬리는 맞닿은 제목 행의 포커스 배경을 따라간다. */}
          <div style={{
            position: "absolute", width: 10, height: 10, transform: "rotate(45deg)", transition: `background-color ${EASE}`,
            ...(place.above
              ? { bottom: -6, borderRight: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, background: theme.bg }
              : { top: -6, borderLeft: `1px solid ${theme.border}`, borderTop: `1px solid ${theme.border}`, background: arrowOn ? theme.accentWeak : theme.surface }),
            ...(place.alignRight ? { right: 22 } : { left: 22 }),
          }} />
          <div style={{ position: "relative", borderRadius: "12px 12px 0 0", overflow: "hidden" }}>
            <div aria-hidden style={{
              position: "absolute", left: 0, right: 0, top: hlRow * ROW_H, height: ROW_H, background: theme.accentWeak,
              opacity: focused ? 1 : 0, transition: `top ${EASE}, opacity ${EASE}`,
            }} />
            {row("title", "제목", title, setTitle)}
            {row("note", "메모", note, setNote)}
            {row("url", "URL", url, setUrl)}
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", padding: "9px 14px", background: theme.bg, borderRadius: "0 0 12px 12px" }}>
            <button type="button" onClick={() => setEditing(false)} style={{ ...actionBtn, padding: "5px 10px", color: theme.textMuted }}>취소</button>
            <button type="button" onClick={save} style={{ border: "none", background: theme.accent, color: "#fff", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>저장</button>
          </div>
        </div>
      )}
    </div>
  );
}
