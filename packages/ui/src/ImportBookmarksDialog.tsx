import { useEffect, useMemo, useRef, useState } from "react";
import {
  outlineSpaces, planImport, defaultEnabled,
  MAX_IMPORT_LINKS, LARGE_FOLDER_THRESHOLD, countLinks,
  type ImportPlan, type PlannedSpace, type SourceNode,
} from "@tablign/core";
import { theme } from "./theme";
import { Button } from "./Button";
import { Favicon } from "./Favicon";
import { TriCheckbox, triCheckboxCss, type TriState } from "./TriCheckbox";
import { overlayAnimationCss, overlayIn, panelIn } from "./overlayAnimation";

export interface ImportOrgOption { id: string; name: string }

export interface ImportBookmarksDialogProps {
  open: boolean;
  /** 다이얼로그 제목 — 소스에 따라 바뀐다(기본 "북마크 가져오기", Toby면 "Toby 가져오기") */
  title?: string;
  /** 정규화된 소스 트리(fromChromeTree·fromTobyExport 결과) */
  roots: SourceNode[];
  /** 가져올 수 있는 조직만 */
  orgs: ImportOrgOption[];
  defaultOrgId: string;
  onImport: (orgId: string, plan: ImportPlan) => Promise<void>;
  onClose: () => void;
}



const mono = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontVariantNumeric: "tabular-nums" as const,
};

/**
 * 이 다이얼로그의 상호작용 스타일. 호버·포커스는 인라인 스타일로 표현할 수 없어 클래스로 뺐다.
 * 라벨은 체크박스를 여러 번 누르다 글자가 잡히는 걸 막으려고 선택을 끈다.
 */
const importPreviewCss = `
/* 레일 스페이스 행 — 체크박스와 라벨을 한 줄에서 수직 중앙 정렬 */
.tbl-imp-row {
  display: flex; align-items: center; gap: 8px; padding: 6px 7px;
  border-radius: 8px; min-width: 0; box-sizing: border-box;
  background: transparent; transition: background .14s ease;
}
.tbl-imp-row:hover { background: ${theme.surface2} }
.tbl-imp-row[data-cur="true"] { background: ${theme.accentWeak} }
.tbl-imp-row[data-cur="true"]:hover { background: #e4e9fd }
.tbl-imp-name {
  flex: 1; min-width: 0; border: none; background: none; padding: 0; margin: 0;
  text-align: left; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 600;
  line-height: 15px; color: #495057; -webkit-user-select: none; user-select: none;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: color .14s ease;
}
.tbl-imp-row[data-cur="true"] .tbl-imp-name { color: ${theme.accent}; font-weight: 700 }
.tbl-imp-row[data-state="none"] .tbl-imp-name { color: ${theme.textFaint} }
.tbl-imp-name:focus-visible { outline: 2px solid ${theme.accent}; outline-offset: 2px; border-radius: 4px }

/* 컬렉션 카드 — 줄 전체가 누를 수 있다는 걸 호버로 알린다 */
.tbl-imp-col { transition: border-color .14s ease, box-shadow .14s ease }
.tbl-imp-col:hover { border-color: #c9d4ff; box-shadow: 0 2px 10px rgba(59,91,219,.07) }
.tbl-imp-coltitle {
  display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;
  border: none; background: none; padding: 0; margin: 0; text-align: left;
  cursor: pointer; font-family: inherit; -webkit-user-select: none; user-select: none;
}
.tbl-imp-coltitle:focus-visible { outline: 2px solid ${theme.accent}; outline-offset: 2px; border-radius: 4px }
.tbl-imp-colname {
  font-size: 12.5px; font-weight: 740; line-height: 15px; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: ${theme.text}; transition: color .14s ease;
}
.tbl-imp-col[data-on="false"] .tbl-imp-colname { color: ${theme.textFaint} }

/* 보드 헤더 스페이스 이름 */
.tbl-imp-boardname {
  font-size: 13.5px; font-weight: 800; letter-spacing: -.015em; line-height: 17px;
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: ${theme.text}; -webkit-user-select: none; user-select: none;
}
.tbl-imp-boardhd[data-state="none"] .tbl-imp-boardname { color: ${theme.textFaint} }

@media (prefers-reduced-motion: reduce) {
  .tbl-imp-row, .tbl-imp-col, .tbl-imp-name, .tbl-imp-colname { transition: none }
}
`;

/**
 * 가져오기 미리보기.
 * 왼쪽 레일에서 스페이스를 고르면 오른쪽에 그 스페이스의 컬렉션·탭만 보인다.
 * 레일에서 이름은 전환, 체크박스는 포함/제외 — 오른쪽에 한 스페이스만 보이므로
 * 레일에 체크가 없으면 빼려는 스페이스마다 일일이 방문해야 한다.
 */
export function ImportBookmarksDialog({
  open, title = "북마크 가져오기", roots, orgs, defaultOrgId, onImport, onClose,
}: ImportBookmarksDialogProps) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [orgId, setOrgId] = useState(defaultOrgId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // 선택 상태와 무관한 전체 윤곽. 꺼진 스페이스도 목록에 남아야 다시 켤 수 있다.
  const outline = useMemo(() => outlineSpaces(roots), [roots]);
  const plan = useMemo(() => planImport(roots, { enabled }), [roots, enabled]);

  // 열릴 때마다 기본 선택값으로 되돌린다
  useEffect(() => {
    if (!open) return;
    setEnabled(defaultEnabled(roots));
    setOrgId(defaultOrgId);
    setActiveId(outlineSpaces(roots)[0]?.sourceId ?? null);
    setBusy(false);
    setError(null);
  }, [open, roots, defaultOrgId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !busy) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  // 스페이스를 바꾸면 보드를 맨 위로 — 이전 스페이스의 스크롤 위치가 남으면 혼란스럽다
  useEffect(() => { if (boardRef.current) boardRef.current.scrollTop = 0; }, [activeId]);

  // 링크 100개 초과로 기본 해제된 폴더가 있으면 이유를 적는다
  const hasLargeFolder = useMemo(
    () => roots.some((r) => (r.children ?? []).some(
      (c) => c.url === undefined && countLinks(c) > LARGE_FOLDER_THRESHOLD,
    )),
    [roots],
  );

  if (!open) return null;

  const active: PlannedSpace | undefined =
    outline.find((s) => s.sourceId === activeId) ?? outline[0];

  function spaceState(sp: PlannedSpace): TriState {
    const on = sp.collections.filter((c) => enabled[c.sourceId]).length;
    if (on === 0) return "none";
    return on === sp.collections.length ? "on" : "some";
  }
  function spaceTabs(sp: PlannedSpace): number {
    return sp.collections.reduce((n, c) => (enabled[c.sourceId] ? n + c.links.length : n), 0);
  }

  function toggleSpace(sp: PlannedSpace) {
    const next = spaceState(sp) !== "on";
    setEnabled((prev) => {
      const out = { ...prev };
      for (const c of sp.collections) out[c.sourceId] = next;
      return out;
    });
  }
  function toggleCollection(sourceId: string) {
    setEnabled((prev) => ({ ...prev, [sourceId]: !prev[sourceId] }));
  }

  const overLimit = plan.totals.links > MAX_IMPORT_LINKS;
  const canImport = plan.totals.spaces > 0 && !overLimit && !busy;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onImport(orgId, plan);
    } catch {
      setError("가져오지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  const eyebrow: React.CSSProperties = {
    fontSize: 9.5, fontWeight: 800, letterSpacing: ".1em", color: theme.textFaint,
  };

  return (
    <div role="presentation" onClick={() => !busy && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", animation: overlayIn,
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <style>{overlayAnimationCss + triCheckboxCss + importPreviewCss}</style>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        style={{ boxSizing: "border-box", width: 770, maxWidth: "calc(100vw - 32px)", animation: panelIn,
          background: theme.surface, borderRadius: 14, boxShadow: "0 18px 50px rgba(0,0,0,.26)",
          overflow: "hidden" }}>

        <div style={{ padding: "16px 18px 0" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{title}</div>
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
            {orgs.length > 1 ? (
              <>
                <label htmlFor="import-org" style={{ fontSize: 12, color: theme.textFaint }}>가져올 조직</label>
                <select id="import-org" value={orgId} disabled={busy}
                  onChange={(e) => setOrgId(e.target.value)}
                  style={{ padding: "5px 8px", border: `1px solid ${theme.border}`, borderRadius: 8,
                    fontSize: 12.5, fontFamily: "inherit", background: theme.surface, color: theme.text }}>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </>
            ) : (
              <div data-testid="import-org-fixed" style={{ fontSize: 12.5, color: theme.textMuted }}>
                가져올 조직 · <strong style={{ color: theme.text }}>{orgs[0]?.name ?? ""}</strong>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", borderTop: `1px solid ${theme.border}`, marginTop: 13, height: 420 }}>
          {/* 왼쪽 — 스페이스: 전환 + 포함/제외 */}
          <div style={{ width: 212, flex: "none", borderRight: `1px solid ${theme.border}`,
            display: "flex", flexDirection: "column" }}>
            <div style={{ ...eyebrow, display: "flex", alignItems: "baseline", padding: "11px 13px 7px" }}>
              <span>스페이스</span>
              <span data-testid="space-count"
                style={{ ...mono, marginLeft: "auto", letterSpacing: 0, fontWeight: 700 }}>
                {plan.totals.spaces}/{outline.length}
              </span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 8px" }}>
              {outline.map((sp) => {
                const st = spaceState(sp);
                const cur = sp.sourceId === active?.sourceId;
                return (
                  <div key={sp.sourceId} className="tbl-imp-row" data-cur={cur} data-state={st}
                    data-testid={`rail-${sp.sourceId}`}>
                    <TriCheckbox state={st} label={`${sp.name} 포함`} onToggle={() => toggleSpace(sp)} />
                    <button type="button" className="tbl-imp-name"
                      onClick={() => setActiveId(sp.sourceId)}>{sp.name}</button>
                    <span style={{ ...mono, fontSize: 10, color: theme.textFaint, flex: "none" }}>
                      {spaceTabs(sp)}
                    </span>
                  </div>
                );
              })}
              {hasLargeFolder && (
                <div data-testid="large-folder-note"
                  style={{ margin: "8px 2px 0", padding: "8px 10px", background: "#fff8ea",
                    border: "1px solid #f2e0b8", borderRadius: 9, fontSize: 11,
                    color: "#7a5a15", lineHeight: 1.5 }}>
                  링크 {LARGE_FOLDER_THRESHOLD}개가 넘는 폴더는 기본으로 빼뒀어요.
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽 — 고른 스페이스 하나 */}
          <div style={{ flex: 1, minWidth: 0, background: theme.bg,
            display: "flex", flexDirection: "column" }}>
            {active && (
              <>
                <div className="tbl-imp-boardhd" data-testid="board-header"
                  data-state={spaceState(active)}
                  style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 16px 10px",
                    borderBottom: `1px solid ${theme.border}`, background: theme.surface }}>
                  <TriCheckbox state={spaceState(active)} label={`${active.name} 포함`}
                    onToggle={() => toggleSpace(active)} />
                  <span className="tbl-imp-boardname">{active.name}</span>
                  <span style={{ ...mono, marginLeft: "auto", flex: "none", fontSize: 10.5,
                    color: theme.textFaint }}>
                    컬렉션 {active.collections.length} · 탭 {spaceTabs(active)}
                  </span>
                </div>

                <div ref={boardRef} style={{ flex: 1, overflowY: "auto", padding: "8px 14px 16px" }}>
                  {active.collections.map((c) => {
                    const on = !!enabled[c.sourceId];
                    return (
                      <div key={c.sourceId} className="tbl-imp-col" data-on={on}
                        data-testid={`col-${c.sourceId}`}
                        style={{ marginBottom: 10, background: theme.surface, boxSizing: "border-box",
                          border: `1px solid ${theme.borderCard}`, borderRadius: 10,
                          padding: "9px 11px 6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <TriCheckbox state={on ? "on" : "none"} label={`${c.title} 포함`}
                            onToggle={() => toggleCollection(c.sourceId)} />
                          <button type="button" className="tbl-imp-coltitle"
                            onClick={() => toggleCollection(c.sourceId)}>
                            <span className="tbl-imp-colname">{c.title}</span>
                            <span style={{ ...mono, marginLeft: "auto", flex: "none", fontSize: 10.5,
                              color: theme.textFaint }}>탭 {c.links.length}</span>
                          </button>
                        </div>
                        <div style={{ opacity: on ? 1 : 0.45 }}>
                          {c.links.map((l, i) => (
                            <div key={`${l.url}-${i}`}
                              style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0,
                                padding: "5px 2px",
                                borderTop: i === 0 ? "none" : `1px solid ${theme.borderCard}` }}>
                              <span style={{ display: "flex", flex: "none" }}>
                                <Favicon url={l.favicon_url} />
                              </span>
                              <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: "#5c636b",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {l.title ?? l.url}
                              </span>
                              <span style={{ ...mono, flex: "none", maxWidth: 150, fontSize: 10.5,
                                color: theme.textFaint, overflow: "hidden", textOverflow: "ellipsis",
                                whiteSpace: "nowrap" }}>{domainOf(l.url)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 상한 초과는 버튼만 비활성하면 이유를 알 수 없다 — 빈 선택과 달리 자명하지 않다 */}
        {overLimit && (
          <div data-testid="over-limit-note"
            style={{ padding: "8px 18px", background: "#fff5f5", borderTop: `1px solid #f5d0d0`,
              fontSize: 12, color: theme.danger }}>
            한 번에 {MAX_IMPORT_LINKS}개까지 가져올 수 있어요. 스페이스나 컬렉션을 줄여주세요.
          </div>
        )}
        {error && (
          <div style={{ padding: "8px 18px", background: "#fff5f5", borderTop: `1px solid #f5d0d0`,
            fontSize: 12, color: theme.danger }}>{error}</div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px 14px",
          borderTop: `1px solid ${theme.border}` }}>
          <span style={{ marginRight: "auto" }} />
          <Button variant="outline" onClick={onClose} disabled={busy}>취소</Button>
          <Button onClick={submit} disabled={!canImport}>{busy ? "가져오는 중…" : "가져오기"}</Button>
        </div>
      </div>
    </div>
  );
}

/** 표시용 도메인. 파싱 실패하면 원문을 그대로 보여준다. */
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
