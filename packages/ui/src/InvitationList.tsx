import { theme } from "./theme";
import { Button } from "./Button";

export interface InvitationItem { id: string; space_name: string; inviter_name: string | null; role: "editor" | "viewer" }
export interface InvitationListProps {
  invitations: InvitationItem[];
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

const ROLE_LABEL: Record<"editor" | "viewer", string> = { editor: "편집자", viewer: "뷰어" };

/** 받은 초대 목록. 헤더 알림 팝오버 안에 넣어 쓴다. */
export function InvitationList({ invitations, onAccept, onDecline }: InvitationListProps) {
  if (invitations.length === 0) {
    return <div style={{ padding: "14px 12px", fontSize: 12.5, color: theme.textFaint }}>받은 초대가 없어요.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8, maxWidth: 300 }}>
      {invitations.map((inv) => (
        <div key={inv.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 9, padding: "9px 11px" }}>
          <div style={{ fontSize: 13, color: theme.text }}>
            {inv.inviter_name ? `${inv.inviter_name}님이 ` : ""}<b>'{inv.space_name}'</b>에 초대했어요
          </div>
          <div style={{ fontSize: 11.5, color: theme.textFaint, marginTop: 2 }}>{ROLE_LABEL[inv.role]} 권한</div>
          <div style={{ marginTop: 8, display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <Button variant="outline" onClick={() => onDecline(inv.id)}>거절</Button>
            <Button onClick={() => onAccept(inv.id)}>수락</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
