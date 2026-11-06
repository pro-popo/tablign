import { Fragment } from "react";
import { theme } from "./theme";
import { useT } from "./i18n";
import { Button } from "./Button";

/** kind: 초대 종류(예: 스페이스·조직) — 있으면 권한 앞에 붙인다 */
export interface InvitationItem { id: string; space_name: string; inviter_name: string | null; role: string; kind?: string }
export interface InvitationListProps {
  invitations: InvitationItem[];
  roles: { value: string; label: string }[];
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

/** 받은 초대 목록. 받은 초대함 팝오버 안에 넣어 쓴다. */
export function InvitationList({ invitations, roles, onAccept, onDecline }: InvitationListProps) {
  const t = useT();
  if (invitations.length === 0) {
    return <div style={{ padding: "14px 12px", fontSize: 12.5, color: theme.textFaint }}>{t.invitationList.empty}</div>;
  }
  function roleLabel(value: string) {
    return roles.find((r) => r.value === value)?.label ?? value;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8, maxWidth: 300 }}>
      {invitations.map((inv) => (
        <div key={inv.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 9, padding: "9px 11px" }}>
          <div style={{ fontSize: 13, color: theme.text }}>
            {t.invitationList.invited(inv.inviter_name).split("{space}").map((part, i) => (
              <Fragment key={i}>{i > 0 && <b>'{inv.space_name}'</b>}{part}</Fragment>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: theme.textFaint, marginTop: 2 }}>{inv.kind ? `${inv.kind} · ` : ""}{t.invitationList.access(roleLabel(inv.role))}</div>
          <div style={{ marginTop: 8, display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <Button variant="outline" onClick={() => onDecline(inv.id)}>{t.invitationList.decline}</Button>
            <Button onClick={() => onAccept(inv.id)}>{t.invitationList.accept}</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
