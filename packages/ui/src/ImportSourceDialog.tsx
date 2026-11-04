import { Fragment, useEffect, useRef, useState } from "react";
import { theme } from "./theme";
import { overlayAnimationCss, overlayIn, panelIn } from "./overlayAnimation";

/**
 * 소스 선택 카드의 상호작용 스타일. 호버·active는 인라인으로 표현할 수 없어 클래스로 뺀다.
 * 호버에서 아이콘 박스가 옅은 배경 → 액센트 채움으로 바뀌어, 무엇을 고르는지 눈이 먼저 안다.
 */
const importSourceCss = `
/* 색·테두리는 반드시 여기에 둔다 — 인라인 스타일로 두면 :hover 규칙이 이길 수 없다. */
.tbl-src-opt {
  border: 1px solid ${theme.border}; border-radius: 11px; background: ${theme.surface};
  cursor: pointer; -webkit-user-select: none; user-select: none;
  transition: background .14s ease, border-color .14s ease;
}
.tbl-src-opt:hover:not(:disabled) { background: ${theme.accentWeak}; border-color: ${theme.accentTint} }
.tbl-src-opt:active:not(:disabled) { background: ${theme.accentSoft} }
.tbl-src-opt:disabled { cursor: default; opacity: .6 }
.tbl-src-opt:focus-visible { outline: 2px solid ${theme.accent}; outline-offset: 2px }
.tbl-src-ico {
  background: ${theme.accentWeak}; color: ${theme.accentInk};
  transition: background .14s ease, color .14s ease;
}
/* 카드가 옅은 라벤더로 물들면 아이콘 박스가 배경에 묻히므로 채움으로 바꿔 살린다 */
.tbl-src-opt:hover:not(:disabled) .tbl-src-ico { background: ${theme.accent}; color: ${theme.onAccent} }
/* 설명 속 "구조" — 올리면 카드 밖에 말풍선이 떠서 카드 크기는 그대로다 */
.tbl-src-term { position: relative; text-decoration: underline dotted ${theme.textFaint}; text-underline-offset: 3px; cursor: help }
.tbl-src-term:hover { color: ${theme.accentInk}; text-decoration-color: ${theme.accentInk} }
.tbl-src-tip {
  position: absolute; top: calc(100% + 9px); left: -14px; z-index: 5; padding: 9px 12px 8px; white-space: nowrap;
  background: ${theme.surface}; border: 1px solid ${theme.border}; border-radius: 10px;
  box-shadow: 0 12px 32px rgba(20,30,60,.18);
  opacity: 0; transform: translateY(-3px); pointer-events: none; transition: opacity .14s ease, transform .14s ease;
}
.tbl-src-tip::before {
  content: ""; position: absolute; top: -5px; left: 20px; width: 8px; height: 8px; background: ${theme.surface};
  border-left: 1px solid ${theme.border}; border-top: 1px solid ${theme.border}; transform: rotate(45deg);
}
.tbl-src-term:hover .tbl-src-tip { opacity: 1; transform: none }
@media (prefers-reduced-motion: reduce) {
  .tbl-src-opt, .tbl-src-ico, .tbl-src-tip { transition: none }
}
`;

const JSON_STRUCTURE = [["groups", "스페이스"], ["lists", "컬렉션"], ["cards", "링크"], ["url", "주소"]] as const;

/** 가져올 수 있는 JSON의 경로 한 줄 — 키 이름 아래에 뜻을 작게. 말풍선과 잘못된 파일 얼럿이 같이 쓴다. */
export function JsonStructurePath() {
  return (
    <span style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
      {JSON_STRUCTURE.map(([key, meaning], i) => (
        <Fragment key={key}>
          {i > 0 && <span style={{ color: theme.textFaint, fontSize: 12, lineHeight: "16px" }}>›</span>}
          <span style={{ display: "flex", flexDirection: "column" }}>
            <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11,
              color: theme.accentInk, lineHeight: "16px" }}>{key}</code>
            <span style={{ fontSize: 10.5, color: theme.textFaint, lineHeight: "14px" }}>{meaning}</span>
          </span>
        </Fragment>
      ))}
    </span>
  );
}

export interface ImportSourceDialogProps {
  open: boolean;
  /** Chrome 북마크를 골랐을 때. 실패(토스트 후 return)해도 다시 시도할 수 있게 완료를 기다린다. */
  onBookmarks: () => void | Promise<void>;
  /** JSON 파일(Toby 내보내기 형식)을 골랐을 때 — 파일의 텍스트를 넘긴다(파싱은 호출자 몫) */
  onTobyFile: (text: string) => void;
  onClose: () => void;
}

/** 가져오기 소스 선택 — 미리보기 다이얼로그(ImportBookmarksDialog) 앞에 끼우는 한 장. */
export function ImportSourceDialog({ open, onBookmarks, onTobyFile, onClose }: ImportSourceDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  // 소스 하나를 고르면 양쪽 버튼을 모두 잠근다 — 파일을 읽는 사이 다른 소스를
  // 트리거하면 나중에 끝나는 쪽이 미리보기를 조용히 덮어쓴다.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 읽는 도중 다이얼로그가 닫히면(open=false) 늦게 도착한 결과를 버린다 —
  // 취소한 줄 알았던 미리보기가 잠시 후 되살아나면 안 된다.
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setError(null);
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function pickBookmarks() {
    setBusy(true);
    setError(null);
    try {
      await onBookmarks();
    } finally {
      // 성공이면 부모가 닫으므로(open=false) 무해하고, 실패면 다시 시도할 수 있어야 한다
      setBusy(false);
    }
  }

  async function onFilePicked(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      // File.text()는 jsdom에 없다 — FileReader는 브라우저·테스트 양쪽에서 동작한다
      const text = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result ?? ""));
        r.onerror = () => reject(r.error);
        r.readAsText(file);
      });
      if (openRef.current) onTobyFile(text);
    } catch {
      if (openRef.current) setError("파일을 읽지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
      // 같은 파일을 다시 골라도 change가 뜨도록 초기화
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // 레이아웃만 인라인. 색·테두리·커서는 importSourceCss가 갖는다(호버가 이길 수 있게).
  const option: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
    padding: "12px 13px", fontFamily: "inherit", boxSizing: "border-box",
  };
  const iconBox: React.CSSProperties = {
    width: 34, height: 34, borderRadius: 9, flex: "none", display: "flex",
    alignItems: "center", justifyContent: "center", fontSize: 16,
  };

  return (
    <div role="presentation" onClick={() => !busy && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", animation: overlayIn,
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <style>{overlayAnimationCss + importSourceCss}</style>
      <div role="dialog" aria-modal="true" aria-label="가져오기" onClick={(e) => e.stopPropagation()}
        style={{ boxSizing: "border-box", width: 340, maxWidth: "calc(100vw - 32px)", animation: panelIn,
          background: theme.surface, borderRadius: 14, padding: "20px 18px 16px",
          boxShadow: "0 18px 50px rgba(0,0,0,.26)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>가져오기</div>
        <div style={{ marginTop: 4, fontSize: 12.5, color: theme.textMuted }}>어디서 가져올까요?</div>

        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" className="tbl-src-opt" style={option} disabled={busy} onClick={pickBookmarks}>
            <span aria-hidden className="tbl-src-ico" style={iconBox}>★</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: theme.text }}>Chrome 북마크</span>
              <span style={{ display: "block", marginTop: 2, fontSize: 12, color: theme.textMuted }}>
                북마크바의 폴더를 그대로 옮겨요
              </span>
            </span>
          </button>

          <button type="button" className="tbl-src-opt" style={option} disabled={busy}
            onClick={() => fileRef.current?.click()}>
            <span aria-hidden className="tbl-src-ico" style={iconBox}>⬒</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: theme.text }}>JSON 파일</span>
              <span style={{ display: "block", marginTop: 2, fontSize: 12, color: theme.textMuted }}>
                <span className="tbl-src-term">
                  구조
                  <span className="tbl-src-tip" data-testid="json-structure-tip" aria-hidden><JsonStructurePath /></span>
                </span>
                에 맞는 JSON 파일을 골라주세요
              </span>
            </span>
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" data-testid="toby-file-input"
            style={{ display: "none" }} onChange={(e) => onFilePicked(e.target.files?.[0])} />
        </div>

        {error && (
          <p style={{ marginTop: 10, fontSize: 12, color: theme.danger }}>{error}</p>
        )}
      </div>
    </div>
  );
}
