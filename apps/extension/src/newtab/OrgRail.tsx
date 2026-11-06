import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Organization, OrganizationMember } from "@tablign/core";
import { LogoMark, Plus, LogOut, Mail, Settings, orgDisplayName, theme, useT } from "@tablign/ui";
import { OrgIconBox } from "./OrgIconBox";

export interface OrgRailProps {
  organizations: Organization[];
  memberships: OrganizationMember[];
  activeOrgId: string | null;
  userEmail: string;
  currentUserId: string;
  avatarUrl?: string | null;
  onSelectOrg: (id: string) => void;
  onCreateOrg: () => void;
  onSignOut: () => void;
  /** 받은 초대(스페이스·조직) 개수 — 0보다 크면 받은 초대함에 배지를 단다 */
  invitationCount: number;
  /** 받은 초대함을 눌렀을 때 뜨는 목록 */
  invitations: ReactNode;
  /** 좁은 화면: 올려도 조직 이름으로 넓어지지 않고, 조직 목록에 올리면 옆에 사이드바를 덮어 띄운다 */
  compact?: boolean;
  onPeekEnter?: () => void;
  onPeekLeave?: () => void;
  /** 좁은 화면에서 조직 아이콘에 올렸을 때 — 그 조직의 스페이스를 미리 보여 준다 */
  onHoverOrg?: (orgId: string) => void;
  /** 스페이스 덮개가 보여 주는 조직 — 그 줄을 흰 탭으로 덮개와 잇는다. 덮개가 닫혀 있으면 null */
  peekOrgId?: string | null;
  /** 설정 패널이 열려 있나 — 설정 버튼을 누른 상태로 보인다 */
  settingsOpen?: boolean;
  /** 설정 버튼 — 오른쪽 서랍에 설정 패널을 열거나 닫는다 */
  onToggleSettings?: () => void;
}

const RAIL_REST = 54;
const RAIL_HOVER = 196;

// 툴팁·프로필 메뉴가 뜨는 모션과 메뉴 항목 올림 — 인라인 스타일로는 못 쓴다
const railCss = `@keyframes tablign-rail-tip { from { opacity: 0; transform: translate(-3px, -50%) } to { opacity: 1; transform: translate(0, -50%) } }
@keyframes tablign-rail-pop { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
.tbl-rail-item { background: none } .tbl-rail-item:hover { background: ${theme.surface2} }
@media (prefers-reduced-motion: reduce) { [style*="tablign-rail-"] { animation: none !important } }`;

export function OrgRail({ organizations, memberships, activeOrgId, userEmail, currentUserId, avatarUrl, onSelectOrg, onCreateOrg, onSignOut, invitationCount, invitations, compact = false, onPeekEnter, onPeekLeave, onHoverOrg, peekOrgId, settingsOpen = false, onToggleSettings }: OrgRailProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  // 받은 초대함·프로필 메뉴 팝오버 — 레일이 overflow:hidden이라 body에 띄우고, 위치는 열 때 누른 줄에 맞춘다
  const [pop, setPop] = useState<{ kind: "inbox" | "account"; left: number; bottom: number } | null>(null);
  // 좁은 화면에선 레일이 펼쳐지지 않으니, 올린 아이콘의 이름을 툴팁으로 띄운다
  const [tip, setTip] = useState<{ kind: "settings" | "inbox"; left: number; top: number } | null>(null);
  const [acctHover, setAcctHover] = useState(false);
  const inboxRef = useRef<HTMLButtonElement>(null);
  const acctRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inboxOpen = pop?.kind === "inbox";
  const acctOpen = pop?.kind === "account";

  useEffect(() => {
    if (!pop) return;
    const anchor = pop.kind === "inbox" ? inboxRef : acctRef;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !anchor.current?.contains(t)) setPop(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setPop(null); }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [pop]);

  function togglePop(kind: "inbox" | "account", el: HTMLElement) {
    if (pop?.kind === kind) { setPop(null); return; }
    const r = el.getBoundingClientRect();
    setPop({ kind, left: r.left + RAIL_REST + 8, bottom: window.innerHeight - r.bottom });
    // 펼쳐진 레일(196px)이 팝오버를 가리지 않게 접는다
    setExpanded(false);
  }
  function showTip(kind: "settings" | "inbox", el: HTMLElement) {
    const r = el.getBoundingClientRect();
    setTip({ kind, left: r.left + RAIL_REST + 8, top: r.top + r.height / 2 });
  }
  const personal = organizations.find((o) => o.is_personal) ?? null;
  const teams = organizations.filter((o) => !o.is_personal);

  const box = (bg: string): React.CSSProperties => ({
    width: 32, height: 32, borderRadius: 9, flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontSize: 12, fontWeight: 700, background: bg, boxSizing: "border-box",
  });
  const row = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 12, height: 40, padding: "0 11px", cursor: "pointer",
    position: "relative", boxSizing: "border-box",
  });
  const label = (active: boolean): React.CSSProperties => ({
    opacity: expanded ? 1 : 0, transition: "opacity .13s ease", whiteSpace: "nowrap",
    fontSize: 12.5, color: active ? theme.accentInk : theme.textSub, fontWeight: active ? 600 : 400,
  });
  const activeBar: React.CSSProperties = {
    content: '""', position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
    width: 4, height: 22, borderRadius: "0 3px 3px 0", background: theme.accent,
  };
  // 덮개와 이어진 줄의 흰 탭 — 레일 오른쪽 끝까지 뻗어 경계선을 덮고, 위아래 모서리는 안쪽으로 휜다(크롬 탭).
  // zIndex -1: 레일 바탕 위, 아이콘 아래에 깔린다.
  const corner = (at: "top" | "bottom"): React.CSSProperties => ({
    position: "absolute", right: 0, [at]: -11, width: 11, height: 12,
    background: `radial-gradient(circle at 0 ${at === "top" ? 0 : "100%"}, transparent 10px, ${theme.border} 10.5px, ${theme.border} 11px, ${theme.pane} 11.5px)`,
  });
  // 탭은 조직 줄 묶음에 하나만 두고 top을 옮겨, 다른 조직에 올리면 그 줄로 미끄러진다(줄 높이 40 + 간격 5).
  const peekIndex = (personal ? [personal, ...teams] : teams).findIndex((o) => o.id === peekOrgId);
  const peekOpen = peekOrgId != null;
  const plainBtn: React.CSSProperties = { width: "100%", border: "none", background: "none", textAlign: "left", fontFamily: "inherit" };
  const avatar = (
    <span style={{ width: 32, height: 32, borderRadius: "50%", background: avatarUrl ? `center/cover url(${avatarUrl})` : theme.surface3, flex: "none", border: `2px solid ${theme.surface}`, boxSizing: "border-box",
      // 메뉴가 열려 있으면 강조색 링, 올리면 조금 진한 테두리
      boxShadow: acctOpen ? `0 0 0 2px ${theme.accent}` : acctHover ? `0 0 0 1px ${theme.borderStrong}` : `0 0 0 1px ${theme.divider}`, transition: "box-shadow .12s" }} />
  );

  return (
    <div
      // 덮개는 조직 묶음에 올려야 열리고, 열린 뒤엔 레일 어디(설정·초대·계정)로 옮겨도 이어지다 레일을 벗어나면 닫힌다
      onMouseEnter={() => { if (!compact) setExpanded(true); if (peekOpen) onPeekEnter?.(); }}
      onMouseLeave={() => { setExpanded(false); onPeekLeave?.(); }}
      style={{
        position: "absolute", left: 0, top: 0, bottom: 0, zIndex: 3,
        width: expanded ? RAIL_HOVER : RAIL_REST, transition: "width .18s ease, box-shadow .18s",
        // 경계선은 border 대신 inset 그림자 — overflow:hidden은 border 안쪽에서 자르므로, border면 이음 탭이 경계선을 덮지 못한다
        background: theme.paneRail,
        backdropFilter: theme.paneBlur,
        boxShadow: `inset -1px 0 0 ${theme.border}, 8px 0 26px rgba(0,0,0,${expanded ? .13 : 0})`,
        padding: "10px 0", display: "flex", flexDirection: "column", gap: 5,
        overflow: "hidden", boxSizing: "border-box",
      }}
    >
      <div role="group" aria-label={t.orgRail.orgs} onMouseEnter={onPeekEnter} onMouseLeave={peekOpen ? undefined : onPeekLeave}
        style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {/* 로고 */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, height: 34, padding: "0 12px", marginBottom: 2 }}>
        {/* flexShrink:0 — 좁은 레일(54px)에서 옆 워드마크(nowrap)에 밀려 SVG가 0폭으로 찌그러지지 않도록 고정 */}
        <span style={{ display: "flex", flexShrink: 0 }}><LogoMark size={26} /></span>
        <span style={{ opacity: expanded ? 1 : 0, transition: "opacity .13s", fontWeight: 740, letterSpacing: "-0.03em", fontSize: 16, color: theme.text, whiteSpace: "nowrap", minWidth: 0, overflow: "hidden" }}>
          tab<span style={{ color: theme.accentInk }}>lign</span>
        </span>
      </div>
      <div style={{ height: 1, background: theme.divider, margin: "2px 12px 4px" }} />

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 5 }}>
      {peekIndex >= 0 && (
        <span data-testid="peek-tab" style={{ position: "absolute", left: 6, right: 0, top: peekIndex * 45 - 2, height: 44, zIndex: -1, boxSizing: "border-box",
          transition: "top .16s ease",
          // 덮개(사이드바)와 같은 바탕 — 배경이 있으면 같이 비친다
          background: theme.pane, border: `1px solid ${theme.border}`, borderRight: "none", borderRadius: "12px 0 0 12px" }}>
          <span style={corner("top")} />
          <span style={corner("bottom")} />
        </span>
      )}

      {/* 개인 조직 */}
      {personal && (() => {
        const active = personal.id === activeOrgId;
        return (
          <div style={row(active)} onClick={() => onSelectOrg(personal.id)} onMouseEnter={() => onHoverOrg?.(personal.id)}>
            {active && <span style={activeBar} />}
            <OrgIconBox org={personal} size={32} />
            <span style={label(active)}>{orgDisplayName(personal, t)}</span>
          </div>
        );
      })()}

      {/* 팀 조직: listOrganizations 순서(created_at)대로 렌더. 멤버십 position 정렬은 2단계(초대·멤버 흐름) 과제.
          memberships·currentUserId prop은 2단계 정렬·권한 표시용 전방 배선(현재 본문 미사용). */}
      {teams.map((o) => {
        const active = o.id === activeOrgId;
        return (
          <div key={o.id} style={row(active)} onClick={() => onSelectOrg(o.id)} onMouseEnter={() => onHoverOrg?.(o.id)}>
            {active && <span style={activeBar} />}
            <OrgIconBox org={o} size={32} />
            <span style={label(active)}>{o.name}</span>
          </div>
        );
      })}
      </div>

      {/* 조직 만들기 */}
      <div style={row(false)} onClick={onCreateOrg}>
        <span style={{ ...box(theme.surface), border: `1px dashed ${theme.textFaint}`, color: theme.textFaint }}><Plus size={15} /></span>
        <span style={{ ...label(false), color: theme.textFaint }}>{t.orgRail.createOrg}</span>
      </div>
      </div>

      <div style={{ flex: 1 }} />
      <div style={{ height: 1, background: theme.divider, margin: "0 12px 4px" }} />
      {/* 받은 초대함 — 스페이스·조직 초대를 모아 둔다 */}
      {onToggleSettings && (
        <button type="button" onClick={() => { setExpanded(false); onToggleSettings(); }} aria-label={t.orgRail.settings} aria-pressed={settingsOpen}
          onMouseEnter={(e) => showTip("settings", e.currentTarget)} onMouseLeave={() => setTip(null)}
          style={{ ...row(settingsOpen), ...plainBtn }}>
          {/* 열려 있으면 조직처럼 막대 + 옅은 강조색 상자 */}
          {settingsOpen && <span style={activeBar} />}
          <span style={{ width: 32, height: 32, borderRadius: 9, flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
            background: settingsOpen ? theme.accentWeak : theme.surface2, color: settingsOpen ? theme.accentInk : theme.textMuted }}>
            <Settings size={17} />
          </span>
          <span style={label(settingsOpen)}>{t.orgRail.settings}</span>
        </button>
      )}
      <button ref={inboxRef} type="button" onClick={(e) => togglePop("inbox", e.currentTarget)}
        aria-label={invitationCount > 0 ? t.orgRail.invitationsCount(invitationCount) : t.orgRail.invitations} aria-expanded={inboxOpen}
        onMouseEnter={(e) => showTip("inbox", e.currentTarget)} onMouseLeave={() => setTip(null)}
        style={{ ...row(inboxOpen), ...plainBtn }}>
        {inboxOpen && <span style={activeBar} />}
        <span style={{ position: "relative", width: 32, height: 32, borderRadius: 9, flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
          // 설정 버튼과 같은 색 — 초대가 있는지는 배지로만 보인다
          background: inboxOpen ? theme.accentWeak : theme.surface2,
          color: inboxOpen ? theme.accentInk : theme.textMuted }}>
          <Mail size={17} />
          {/* 접혀 있을 땐 상자 모서리 배지, 펼치면 줄 오른쪽 끝 개수로 옮긴다 */}
          {invitationCount > 0 && !expanded && (
            <span style={{ position: "absolute", top: -5, right: -6, minWidth: 15, height: 15, padding: "0 4px", borderRadius: 8, background: theme.accent, color: theme.onAccent,
              fontSize: 9.5, fontWeight: 800, lineHeight: "15px", textAlign: "center", border: `2px solid ${theme.rail}`, boxSizing: "content-box" }}>{invitationCount}</span>
          )}
        </span>
        <span style={label(inboxOpen)}>{t.orgRail.invitations}</span>
        {invitationCount > 0 && expanded && (
          <span style={{ marginLeft: "auto", minWidth: 20, height: 18, padding: "0 6px", borderRadius: 9, background: theme.accent, color: theme.onAccent,
            fontSize: 11, fontWeight: 700, lineHeight: "18px", textAlign: "center", boxSizing: "border-box" }}>{invitationCount}</span>
        )}
      </button>
      {/* 계정 — 좁은 화면에선 이메일·로그아웃이 안 보이니 눌러서 메뉴로 연다 */}
      {compact ? (
        <button ref={acctRef} type="button" onClick={(e) => togglePop("account", e.currentTarget)}
          aria-label={t.orgRail.account} aria-haspopup="menu" aria-expanded={acctOpen}
          onMouseEnter={() => setAcctHover(true)} onMouseLeave={() => setAcctHover(false)}
          style={{ ...row(false), ...plainBtn }}>
          {avatar}
        </button>
      ) : (
        <div style={row(false)} title={userEmail}>
          {avatar}
          <span style={{ ...label(false), overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{userEmail}</span>
          {expanded && (
            <button
              type="button"
              title={t.orgRail.signOut}
              aria-label={t.orgRail.signOut}
              onClick={(e) => { e.stopPropagation(); onSignOut(); }}
              style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 3, flexShrink: 0, color: theme.textFaint }}
            >
              <LogOut size={15} color={theme.textFaint} />
            </button>
          )}
        </div>
      )}
      <style>{railCss}</style>
      {/* 팝오버가 떠 있으면 툴팁이 그 위를 가리므로 띄우지 않는다 */}
      {compact && tip && !pop && createPortal(
        <div role="tooltip"
          style={{ position: "fixed", left: tip.left, top: tip.top, zIndex: 1000, transform: "translateY(-50%)", whiteSpace: "nowrap", pointerEvents: "none",
            fontSize: 12, fontWeight: 600, padding: "6px 9px", borderRadius: 7, background: theme.text, color: theme.surface, animation: "tablign-rail-tip .12s ease" }}>
          <span style={{ position: "absolute", left: -4, top: "50%", width: 8, height: 8, transform: "translateY(-50%) rotate(45deg)", borderRadius: 1, background: theme.text }} />
          {tip.kind === "settings" ? t.orgRail.settings : t.orgRail.invitations}
          {tip.kind === "inbox" && invitationCount > 0 && (
            // 툴팁 바탕(글자색)과 반대쪽으로 섞은 강조색 — 다크 모드에서 툴팁이 밝아져도 읽힌다
            <span style={{ marginLeft: 6, fontWeight: 700, color: `color-mix(in srgb, ${theme.accent} 45%, ${theme.surface})` }}>{invitationCount}</span>
          )}
        </div>,
        document.body,
      )}
      {pop?.kind === "account" && createPortal(
        <div ref={popRef} role="menu" aria-label={t.orgRail.account}
          style={{ position: "fixed", left: pop.left, bottom: pop.bottom, zIndex: 1000, width: 200, padding: "6px 0", animation: "tablign-rail-pop .14s ease",
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(20,30,60,.18)" }}>
          <div style={{ padding: "8px 14px 9px", fontSize: 12, color: theme.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</div>
          <div style={{ height: 1, background: theme.divider, margin: "0 0 4px" }} />
          <button type="button" role="menuitem" className="tbl-rail-item" onClick={() => { setPop(null); onSignOut(); }}
            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", height: 34, padding: "0 14px", border: "none", fontFamily: "inherit", fontSize: 13, color: theme.textSub, cursor: "pointer" }}>
            <LogOut size={15} color={theme.textMuted} />
            {t.orgRail.signOut}
          </button>
        </div>,
        document.body,
      )}
      {pop?.kind === "inbox" && createPortal(
        <div ref={popRef} role="dialog" aria-label={t.orgRail.invitations}
          style={{ position: "fixed", left: pop.left, bottom: pop.bottom, zIndex: 1000, width: 300, maxHeight: "calc(100vh - 16px)", overflow: "auto",
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(20,30,60,.18)", padding: "12px 0 0" }}>
          <div style={{ padding: "0 14px", fontSize: 12, fontWeight: 700, color: theme.textMuted }}>{t.orgRail.invitations}</div>
          {invitations}
        </div>,
        document.body,
      )}
    </div>
  );
}
