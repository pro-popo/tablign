import { useEffect, useMemo, useState } from "react";
import {
  planImport, defaultEnabled, countLinks, looseSourceId,
  MAX_IMPORT_LINKS, LARGE_FOLDER_THRESHOLD,
  type ImportPlan, type SourceNode,
} from "@tablign/core";
import { theme } from "./theme";
import { Button } from "./Button";
import { overlayAnimationCss, overlayIn, panelIn } from "./overlayAnimation";

export interface ImportOrgOption { id: string; name: string }

export interface ImportBookmarksDialogProps {
  open: boolean;
  /** 정규화된 소스 트리(fromChromeTree 결과) */
  roots: SourceNode[];
  /** 가져올 수 있는 조직만 */
  orgs: ImportOrgOption[];
  defaultOrgId: string;
  onImport: (orgId: string, plan: ImportPlan) => Promise<void>;
  onClose: () => void;
}

/** 트리에 그릴 한 줄. 폴더와 루트 직속 링크 묶음만 줄이 된다(링크는 개수로만 나온다). */
interface Row {
  id: string;
  label: string;
  depth: number;
  /** 1단 폴더(=스페이스가 될 것)인지 */
  isSpace: boolean;
  /** 직속 링크 수 */
  count: number;
  /** 깊이 3 이상에서 합쳐질 이름 힌트 */
  joined?: string;
  /** 스페이스 행이면 함께 끌 자손 폴더 id들 */
  descendants: string[];
  /** 루트 이름(직속 링크 묶음 행에만) */
  rootName?: string;
}

const isFolder = (n: SourceNode) => n.url === undefined;
const directLinkCount = (n: SourceNode) => (n.children ?? []).filter((c) => !isFolder(c)).length;
const mono = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontVariantNumeric: "tabular-nums" as const,
};

function buildRows(roots: SourceNode[]): { name: string; rows: Row[] }[] {
  const groups: { name: string; rows: Row[] }[] = [];
  for (const root of roots) {
    const rows: Row[] = [];
    for (const child of root.children ?? []) {
      if (!isFolder(child)) continue;
      const descendants: string[] = [];
      const collect = (n: SourceNode) => {
        for (const g of n.children ?? []) if (isFolder(g)) { descendants.push(g.id); collect(g); }
      };
      collect(child);
      rows.push({
        id: child.id, label: child.title, depth: 1, isSpace: true,
        count: directLinkCount(child), descendants,
      });
      const walk = (n: SourceNode, depth: number, prefix: string) => {
        for (const g of n.children ?? []) {
          if (!isFolder(g)) continue;
          const joined = prefix ? `${prefix}/${g.title}` : g.title;
          rows.push({
            id: g.id, label: g.title, depth, isSpace: false,
            count: directLinkCount(g), descendants: [],
            joined: depth >= 3 ? joined : undefined,
          });
          walk(g, depth + 1, joined);
        }
      };
      walk(child, 2, "");
    }
    const looseCount = directLinkCount(root);
    if (looseCount) {
      rows.push({
        id: looseSourceId(root.id), label: "폴더에 없는 링크", depth: 1, isSpace: true,
        count: looseCount, descendants: [], rootName: root.title,
      });
    }
    if (rows.length) groups.push({ name: root.title, rows });
  }
  return groups;
}

/** 북마크 가져오기 다이얼로그. 왼쪽에서 고르면 오른쪽에 만들어질 결과가 즉시 바뀐다. */
export function ImportBookmarksDialog({
  open, roots, orgs, defaultOrgId, onImport, onClose,
}: ImportBookmarksDialogProps) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [orgId, setOrgId] = useState(defaultOrgId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 열릴 때마다 기본 선택값으로 되돌린다
  useEffect(() => {
    if (!open) return;
    setEnabled(defaultEnabled(roots));
    setOrgId(defaultOrgId);
    setBusy(false);
    setError(null);
  }, [open, roots, defaultOrgId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !busy) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const groups = useMemo(() => buildRows(roots), [roots]);
  const plan = useMemo(() => planImport(roots, { enabled }), [roots, enabled]);

  // 100개 초과로 기본 해제된 폴더가 있으면 이유를 적는다
  const hasLargeFolder = useMemo(
    () => roots.some((r) => (r.children ?? []).some(
      (c) => isFolder(c) && countLinks(c) > LARGE_FOLDER_THRESHOLD,
    )),
    [roots],
  );

  if (!open) return null;

  const overLimit = plan.totals.links > MAX_IMPORT_LINKS;
  const canImport = plan.totals.spaces > 0 && !overLimit && !busy;

  function toggle(row: Row) {
    setEnabled((prev) => {
      const next = { ...prev, [row.id]: !prev[row.id] };
      // 스페이스를 끄면 자손도 함께 꺼진다
      for (const d of row.descendants) next[d] = next[row.id];
      return next;
    });
  }

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

  return (
    <div role="presentation" onClick={() => !busy && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", animation: overlayIn,
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <style>{overlayAnimationCss}</style>
      <div role="dialog" aria-modal="true" aria-label="북마크 가져오기" onClick={(e) => e.stopPropagation()}
        style={{ boxSizing: "border-box", width: 730, maxWidth: "calc(100vw - 32px)", animation: panelIn,
          background: theme.surface, borderRadius: 14, boxShadow: "0 18px 50px rgba(0,0,0,.26)", overflow: "hidden" }}>

        <div style={{ padding: "17px 18px 0" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>북마크 가져오기</div>
          <div style={{ marginTop: 4, fontSize: 12.5, color: theme.textMuted }}>
            왼쪽에서 고르면 오른쪽에 만들어질 결과가 보여요.
          </div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
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
              <div data-testid="import-org-fixed" style={{ fontSize: 12, color: theme.textFaint }}>
                가져올 조직 · <strong style={{ color: theme.text }}>{orgs[0]?.name ?? ""}</strong>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", borderTop: `1px solid ${theme.border}`, marginTop: 14 }}>
          {/* 왼쪽 — 내 북마크 */}
          <div style={{ width: 336, flex: "none", borderRight: `1px solid ${theme.border}` }}>
            <div style={{ padding: "9px 13px 7px", fontSize: 10.5, fontWeight: 800,
              letterSpacing: ".07em", color: theme.textFaint }}>내 북마크</div>
            <div style={{ height: 344, overflowY: "auto", padding: "2px 8px 10px", boxSizing: "border-box" }}>
              {groups.map((g) => (
                <div key={g.name}>
                  <div style={{ padding: "9px 9px 4px", fontSize: 10.5, fontWeight: 800,
                    letterSpacing: ".07em", color: theme.textFaint }}>{g.name}</div>
                  {g.rows.map((row) => {
                    const on = !!enabled[row.id];
                    return (
                      <div key={row.id} data-testid={`tree-row-${row.id}`} role="button" tabIndex={0}
                        onClick={() => toggle(row)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(row); } }}
                        style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 31,
                          padding: "5px 8px", borderRadius: 8, cursor: "pointer", fontSize: 13,
                          boxSizing: "border-box", marginLeft: (row.depth - 1) * 19 }}>
                        <span aria-hidden style={{ width: 15, height: 15, flex: "none", borderRadius: 4.5,
                          boxSizing: "border-box",
                          border: `1.5px solid ${on ? theme.accent : "#ccd2da"}`,
                          background: on ? theme.accent : theme.surface }} />
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap", fontWeight: 500,
                          color: on ? theme.text : theme.textFaint }}>{row.label}</span>
                        {row.count > 0 && (
                          <span style={{ ...mono, fontSize: 11, color: theme.textFaint }}>{row.count}</span>
                        )}
                        {row.joined && (
                          <span style={{ marginLeft: "auto", fontSize: 11, color: theme.textFaint }}>{row.joined}</span>
                        )}
                        {row.isSpace && (
                          <span style={{ marginLeft: "auto", flex: "none", padding: "0 7px", height: 22,
                            display: "inline-flex", alignItems: "center", borderRadius: 7, fontSize: 10.5,
                            fontWeight: 700, boxSizing: "border-box",
                            border: `1px solid ${on ? theme.borderCard : theme.border}`,
                            background: on ? theme.accentWeak : theme.surface2,
                            color: on ? theme.accent : theme.textFaint }}>
                            {row.rootName ?? "스페이스"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {hasLargeFolder && (
                <div data-testid="large-folder-note"
                  style={{ margin: "8px 4px 0", padding: "8px 10px", background: "#fff8ea",
                    border: "1px solid #f2e0b8", borderRadius: 9, fontSize: 11.5,
                    color: "#7a5a15", lineHeight: 1.5 }}>
                  링크 {LARGE_FOLDER_THRESHOLD}개가 넘는 폴더는 기본으로 빼뒀어요. 필요하면 켜세요.
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽 — 만들어질 결과 */}
          <div style={{ flex: 1, minWidth: 0, background: theme.bg }}>
            <div style={{ display: "flex", padding: "9px 13px 7px", fontSize: 10.5, fontWeight: 800,
              letterSpacing: ".07em", color: theme.textFaint }}>
              <span>이렇게 만들어져요</span>
              <span style={{ ...mono, marginLeft: "auto", letterSpacing: 0, fontWeight: 700 }}>
                스페이스 {plan.totals.spaces} · 컬렉션 {plan.totals.collections}
              </span>
            </div>
            <div style={{ height: 344, overflowY: "auto", padding: "8px 12px 12px", boxSizing: "border-box" }}>
              {plan.spaces.length === 0 && (
                <div style={{ padding: "26px 10px", textAlign: "center", fontSize: 11.5,
                  color: theme.textFaint, lineHeight: 1.6 }}>
                  가져올 폴더를 왼쪽에서 골라주세요.
                </div>
              )}
              {plan.spaces.map((sp) => (
                <div key={sp.sourceId} data-testid={`preview-space-${sp.sourceId}`}
                  style={{ background: theme.surface, border: `1px solid ${theme.borderCard}`,
                    borderRadius: 10, padding: "9px 10px", marginBottom: 8, boxSizing: "border-box" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: theme.text }}>{sp.name}</span>
                    <span style={{ ...mono, marginLeft: "auto", fontSize: 11, color: theme.textFaint }}>
                      컬렉션 {sp.collections.length}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {sp.collections.map((c) => (
                      <div key={c.sourceId + c.title} data-testid={`preview-col-${c.sourceId}`}
                        style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px",
                          background: theme.bg, borderRadius: 8, boxSizing: "border-box",
                          border: `1px ${c.synthetic ? "dashed" : "solid"} ${theme.borderCard}` }}>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: theme.text,
                          minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap" }}>{c.title}</span>
                        {c.duplicatesDropped > 0 && (
                          <span style={{ ...mono, marginLeft: "auto", flex: "none", fontSize: 10,
                            fontWeight: 700, color: "#a13030", background: "#fdeeee",
                            border: "1px solid #f5d0d0", borderRadius: 5, padding: "1px 5px" }}>
                            −{c.duplicatesDropped}
                          </span>
                        )}
                        <span style={{ ...mono, marginLeft: c.duplicatesDropped ? 6 : "auto",
                          flex: "none", fontSize: 11, color: theme.textFaint }}>{c.links.length}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px 14px",
          borderTop: `1px solid ${theme.border}` }}>
          <span data-testid="import-summary" style={{ marginRight: "auto", fontSize: 12,
            color: theme.textMuted, lineHeight: 1.5 }}>
            {plan.totals.spaces === 0 ? "가져올 폴더가 없어요" : (
              <>
                링크 <strong style={{ ...mono, color: theme.text }}>{plan.totals.links}</strong>개를
                {" "}스페이스 <strong style={{ ...mono, color: theme.text }}>{plan.totals.spaces}</strong>개로 가져와요
                {plan.totals.duplicates > 0 && (
                  <span style={{ display: "block", fontSize: 11, color: theme.textFaint, marginTop: 1 }}>
                    중복 URL {plan.totals.duplicates}개는 한 번만 담아요
                  </span>
                )}
              </>
            )}
            {overLimit && (
              <span data-testid="over-limit-note"
                style={{ display: "block", fontSize: 11, color: theme.danger, marginTop: 1 }}>
                한 번에 {MAX_IMPORT_LINKS}개까지 가져올 수 있어요. 폴더를 줄여주세요.
              </span>
            )}
            {error && (
              <span style={{ display: "block", fontSize: 11.5, color: theme.danger, marginTop: 2 }}>{error}</span>
            )}
          </span>
          <Button variant="outline" onClick={onClose} disabled={busy}>취소</Button>
          <Button onClick={submit} disabled={!canImport}>{busy ? "가져오는 중…" : "가져오기"}</Button>
        </div>
      </div>
    </div>
  );
}
