import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Organization, OrganizationMember } from "@tablign/core";
import { LogoMark, Plus, LogOut, Mail, theme } from "@tablign/ui";
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
}

const RAIL_REST = 54;
const RAIL_HOVER = 196;

export function OrgRail({ organizations, memberships, activeOrgId, userEmail, currentUserId, avatarUrl, onSelectOrg, onCreateOrg, onSignOut, invitationCount, invitations }: OrgRailProps) {
  const [expanded, setExpanded] = useState(false);
  // 받은 초대함 팝오버 — 레일이 overflow:hidden이라 body에 띄우고, 위치는 열 때 받은 초대함 줄에 맞춘다
  const [inbox, setInbox] = useState<{ left: number; bottom: number } | null>(null);
  const inboxRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!inbox) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !inboxRef.current?.contains(t)) setInbox(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setInbox(null); }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [inbox]);

  function toggleInbox() {
    if (inbox) { setInbox(null); return; }
    const r = inboxRef.current!.getBoundingClientRect();
    setInbox({ left: r.left + RAIL_REST + 8, bottom: window.innerHeight - r.bottom });
    // 펼쳐진 레일(196px)이 팝오버를 가리지 않게 접는다
    setExpanded(false);
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
    fontSize: 12.5, color: active ? theme.accent : "#495057", fontWeight: active ? 600 : 400,
  });
  const activeBar: React.CSSProperties = {
    content: '""', position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
    width: 4, height: 22, borderRadius: "0 3px 3px 0", background: theme.accent,
  };

  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        position: "absolute", left: 0, top: 0, bottom: 0, zIndex: 3,
        width: expanded ? RAIL_HOVER : RAIL_REST, transition: "width .18s ease, box-shadow .18s",
        background: "#f5f6f8", borderRight: `1px solid ${theme.border}`,
        boxShadow: expanded ? "8px 0 26px rgba(0,0,0,.13)" : "none",
        padding: "10px 0", display: "flex", flexDirection: "column", gap: 5,
        overflow: "hidden", boxSizing: "border-box",
      }}
    >
      {/* 로고 */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, height: 34, padding: "0 12px", marginBottom: 2 }}>
        {/* flexShrink:0 — 좁은 레일(54px)에서 옆 워드마크(nowrap)에 밀려 SVG가 0폭으로 찌그러지지 않도록 고정 */}
        <span style={{ display: "flex", flexShrink: 0 }}><LogoMark size={26} /></span>
        <span style={{ opacity: expanded ? 1 : 0, transition: "opacity .13s", fontWeight: 740, letterSpacing: "-0.03em", fontSize: 16, color: theme.text, whiteSpace: "nowrap", minWidth: 0, overflow: "hidden" }}>
          tab<span style={{ color: theme.accent }}>lign</span>
        </span>
      </div>
      <div style={{ height: 1, background: "#e2e5ea", margin: "2px 12px 4px" }} />

      {/* 개인 조직 */}
      {personal && (() => {
        const active = personal.id === activeOrgId;
        return (
          <div style={row(active)} onClick={() => onSelectOrg(personal.id)}>
            {active && <span style={activeBar} />}
            <OrgIconBox org={personal} size={32} />
            <span style={label(active)}>개인</span>
          </div>
        );
      })()}

      {/* 팀 조직: listOrganizations 순서(created_at)대로 렌더. 멤버십 position 정렬은 2단계(초대·멤버 흐름) 과제.
          memberships·currentUserId prop은 2단계 정렬·권한 표시용 전방 배선(현재 본문 미사용). */}
      {teams.map((o) => {
        const active = o.id === activeOrgId;
        return (
          <div key={o.id} style={row(active)} onClick={() => onSelectOrg(o.id)}>
            {active && <span style={activeBar} />}
            <OrgIconBox org={o} size={32} />
            <span style={label(active)}>{o.name}</span>
          </div>
        );
      })}

      {/* 조직 만들기 */}
      <div style={row(false)} onClick={onCreateOrg}>
        <span style={{ ...box("#fff"), border: `1px dashed ${theme.textFaint}`, color: theme.textFaint }}><Plus size={15} /></span>
        <span style={{ ...label(false), color: theme.textFaint }}>조직 만들기</span>
      </div>

      <div style={{ flex: 1 }} />
      <div style={{ height: 1, background: "#e2e5ea", margin: "0 12px 4px" }} />
      {/* 받은 초대함 — 스페이스·조직 초대를 모아 둔다 */}
      <button ref={inboxRef} type="button" onClick={toggleInbox}
        aria-label={invitationCount > 0 ? `받은 초대 ${invitationCount}개` : "받은 초대"} aria-expanded={!!inbox}
        style={{ ...row(false), width: "100%", border: "none", background: "none", textAlign: "left", fontFamily: "inherit" }}>
        <span style={{ position: "relative", width: 32, height: 32, borderRadius: 9, flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
          background: inbox ? "#e2e6ec" : invitationCount > 0 ? "#e9ecf0" : "#eef0f3",
          color: inbox ? theme.text : invitationCount > 0 ? "#6b7280" : "#b4bac3" }}>
          <Mail size={17} />
          {/* 접혀 있을 땐 상자 모서리 배지, 펼치면 줄 오른쪽 끝 개수로 옮긴다 */}
          {invitationCount > 0 && !expanded && (
            <span style={{ position: "absolute", top: -5, right: -6, minWidth: 15, height: 15, padding: "0 4px", borderRadius: 8, background: theme.accent, color: "#fff",
              fontSize: 9.5, fontWeight: 800, lineHeight: "15px", textAlign: "center", border: "2px solid #f5f6f8", boxSizing: "content-box" }}>{invitationCount}</span>
          )}
        </span>
        <span style={label(false)}>받은 초대</span>
        {invitationCount > 0 && expanded && (
          <span style={{ marginLeft: "auto", minWidth: 20, height: 18, padding: "0 6px", borderRadius: 9, background: theme.accent, color: "#fff",
            fontSize: 11, fontWeight: 700, lineHeight: "18px", textAlign: "center", boxSizing: "border-box" }}>{invitationCount}</span>
        )}
      </button>
      {/* 계정 */}
      <div style={row(false)} title={userEmail}>
        <span style={{ width: 32, height: 32, borderRadius: "50%", background: avatarUrl ? `center/cover url(${avatarUrl})` : "#dfe2ea", flex: "none", border: "2px solid #fff", boxShadow: "0 0 0 1px #e2e5ea", boxSizing: "border-box" }} />
        <span style={{ ...label(false), overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{userEmail}</span>
        {expanded && (
          <button
            type="button"
            title="로그아웃"
            aria-label="로그아웃"
            onClick={(e) => { e.stopPropagation(); onSignOut(); }}
            style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 3, flexShrink: 0, color: theme.textFaint }}
          >
            <LogOut size={15} color={theme.textFaint} />
          </button>
        )}
      </div>
      {inbox && createPortal(
        <div ref={popRef} role="dialog" aria-label="받은 초대"
          style={{ position: "fixed", left: inbox.left, bottom: inbox.bottom, zIndex: 1000, width: 300, maxHeight: "calc(100vh - 16px)", overflow: "auto",
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(20,30,60,.18)", padding: "12px 0 0" }}>
          <div style={{ padding: "0 14px", fontSize: 12, fontWeight: 700, color: theme.textMuted }}>받은 초대</div>
          {invitations}
        </div>,
        document.body,
      )}
    </div>
  );
}
