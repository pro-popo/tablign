import { useState } from "react";
import type { Organization, OrganizationMember } from "@tablign/core";
import { LogoMark, Plus, LogOut, theme } from "@tablign/ui";
import { orgIconStyle, PERSONAL_DEFAULT_ICON, PERSONAL_DEFAULT_COLOR } from "./orgIcon";

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
}

const RAIL_REST = 54;
const RAIL_HOVER = 196;
const TEAM_COLORS = ["#20a97e", "#e8590c", "#7048e8", "#1098ad", "#e64980"];

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export function OrgRail({ organizations, memberships, activeOrgId, userEmail, currentUserId, avatarUrl, onSelectOrg, onCreateOrg, onSignOut }: OrgRailProps) {
  const [expanded, setExpanded] = useState(false);
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
            <span style={{ ...box(personal.color ?? PERSONAL_DEFAULT_COLOR), overflow: "hidden" }}>
              <span style={orgIconStyle(personal, 32)}>{personal.icon ?? PERSONAL_DEFAULT_ICON}</span>
            </span>
            <span style={label(active)}>개인</span>
          </div>
        );
      })()}

      {/* 팀 조직: listOrganizations 순서(created_at)대로 렌더. 멤버십 position 정렬은 2단계(초대·멤버 흐름) 과제.
          memberships·currentUserId prop은 2단계 정렬·권한 표시용 전방 배선(현재 본문 미사용). */}
      {teams.map((o, i) => {
        const active = o.id === activeOrgId;
        return (
          <div key={o.id} style={row(active)} onClick={() => onSelectOrg(o.id)}>
            {active && <span style={activeBar} />}
            <span style={{ ...box(o.color ?? TEAM_COLORS[i % TEAM_COLORS.length]), overflow: "hidden" }}>
              {o.icon ? <span style={orgIconStyle(o, 32)}>{o.icon}</span> : initials(o.name)}
            </span>
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
    </div>
  );
}
