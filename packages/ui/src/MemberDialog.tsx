import { useEffect, useState } from "react";
import { theme } from "./theme";
import { useT } from "./i18n";
import { Button } from "./Button";
import { X } from "./icons";
import { overlayAnimationCss, overlayIn, panelIn } from "./overlayAnimation";

export interface MemberRow { user_id: string; role: string; display_name: string | null; avatar_url: string | null }
export interface InviteRow { id: string; invitee_email: string; role: string }
export interface RoleOption { value: string; label: string }
export interface MemberDialogProps {
  open: boolean;
  spaceName: string;
  roles: RoleOption[];
  members: MemberRow[];
  pendingInvites: InviteRow[];
  onInvite: (email: string, role: string) => void;
  onChangeRole: (userId: string, role: string) => void;
  onRemove: (userId: string) => void;
  onCancelInvite: (id: string) => void;
  onClose: () => void;
}

export function MemberDialog({ open, spaceName, roles, members, pendingInvites, onInvite, onChangeRole, onRemove, onCancelInvite, onClose }: MemberDialogProps) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(roles[0]?.value ?? "");
  useEffect(() => { if (!open) { setEmail(""); setRole(roles[0]?.value ?? ""); } }, [open, roles]);
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;

  function roleLabel(value: string) {
    return roles.find((r) => r.value === value)?.label ?? value;
  }

  function submitInvite() {
    const v = email.trim();
    if (!v) return;
    onInvite(v, role);
    setEmail("");
  }

  return (
    <div role="presentation" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", animation: overlayIn, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <style>{overlayAnimationCss}</style>
      <div role="dialog" aria-modal="true" aria-label={t.memberDialog.label} onClick={(e) => e.stopPropagation()}
        style={{ width: 380, maxWidth: "calc(100vw - 32px)", animation: panelIn, background: theme.surface, borderRadius: 12, padding: "20px 20px 16px", boxShadow: "0 12px 40px rgba(0,0,0,.22)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{t.memberDialog.heading(spaceName)}</div>

        {/* 초대 입력 */}
        <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.memberDialog.emailPlaceholder}
            onKeyDown={(e) => { if (e.key === "Enter") submitInvite(); }}
            style={{ flex: 1, padding: "8px 10px", border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          <select value={role} onChange={(e) => setRole(e.target.value)}
            aria-label={t.memberDialog.role} style={{ border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, padding: "0 6px" }}>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <Button onClick={submitInvite}>{t.memberDialog.invite}</Button>
        </div>

        {/* 멤버 목록 */}
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          {members.map((m) => (
            <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: m.avatar_url ? `center/cover url(${m.avatar_url})` : theme.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: theme.textMuted, flexShrink: 0 }}>
                {!m.avatar_url && (m.display_name?.[0] ?? "?")}
              </div>
              <span style={{ flex: 1, fontSize: 13, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.display_name ?? t.memberDialog.noName}</span>
              <select value={m.role} onChange={(e) => onChangeRole(m.user_id, e.target.value)}
                aria-label={t.memberDialog.memberRole} style={{ border: `1px solid ${theme.border}`, borderRadius: 7, fontSize: 12, padding: "2px 4px" }}>
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <button type="button" title={t.memberDialog.remove} aria-label={t.memberDialog.remove} onClick={() => onRemove(m.user_id)}
                style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 3 }}>
                <X size={14} color={theme.textFaint} />
              </button>
            </div>
          ))}
          {pendingInvites.map((inv) => (
            <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.7 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: theme.surface2, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, color: theme.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.invitee_email}</span>
              <span style={{ fontSize: 11, color: theme.textFaint }}>{t.memberDialog.pending(roleLabel(inv.role))}</span>
              <button type="button" title={t.memberDialog.cancelInvite} aria-label={t.memberDialog.cancelInvite} onClick={() => onCancelInvite(inv.id)}
                style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 3 }}>
                <X size={14} color={theme.textFaint} />
              </button>
            </div>
          ))}
          {members.length === 0 && pendingInvites.length === 0 && (
            <div style={{ fontSize: 12.5, color: theme.textFaint, padding: "6px 2px" }}>{t.memberDialog.empty}</div>
          )}
        </div>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <Button variant="outline" onClick={onClose}>{t.common.close}</Button>
        </div>
      </div>
    </div>
  );
}
