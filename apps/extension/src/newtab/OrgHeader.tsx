import type { Organization, OrgMemberWithProfile } from "@tablign/core";
import { MemberAvatars, theme } from "@tablign/ui";

export type OrgRole = "owner" | "admin" | "member";
const ROLE_CHIP: Record<OrgRole, { label: string; bg: string; fg: string }> = {
  owner:  { label: "소유자", bg: "#fff4e6", fg: "#e8590c" },
  admin:  { label: "관리자", bg: "#edf0fe", fg: "#3b5bdb" },
  member: { label: "멤버",   bg: "#f1f3f5", fg: "#868e96" },
};

export interface OrgHeaderProps {
  org: Organization;
  members: OrgMemberWithProfile[];
  myRole: OrgRole;
  onOpenMembers: () => void;
}

export function OrgHeader({ org, members, myRole, onOpenMembers }: OrgHeaderProps) {
  const chip = ROLE_CHIP[myRole];
  const isPersonal = org.is_personal;
  // 멤버는 조직 관리 권한이 없어 다이얼로그를 열 수 없으므로 톱니바퀴를 숨긴다.
  // 개인 조직은 단일 사용자 전용(멤버 초대·관리 개념이 없음)이라 소유자여도 톱니바퀴를 숨긴다.
  const showGear = !isPersonal && myRole !== "member";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <strong style={{ fontSize: 15, color: theme.text }}>{org.name}</strong>
      {!isPersonal && (
        <>
          {members.length > 0 && <MemberAvatars people={members} />}
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: chip.bg, color: chip.fg, boxSizing: "border-box" }}>
            {chip.label}
          </span>
        </>
      )}
      {showGear && (
        <button type="button" title="멤버·설정" aria-label="조직 설정" onClick={onOpenMembers}
          style={{ marginLeft: 2, border: "none", background: "none", cursor: "pointer", display: "flex", padding: 3, color: theme.textFaint }}>
          {/* lucide settings */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      )}
    </div>
  );
}
