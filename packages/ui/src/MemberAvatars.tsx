import { theme } from "./theme";

export interface AvatarPerson { display_name: string | null; avatar_url: string | null }

/** 멤버 아바타를 겹쳐 보여주는 스택. 초과분은 +N으로 표시. */
export function MemberAvatars({ people, max = 4 }: { people: AvatarPerson[]; max?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {shown.map((p, i) => (
        <div key={i} title={p.display_name ?? undefined}
          style={{
            width: 24, height: 24, borderRadius: "50%", marginLeft: i === 0 ? 0 : -8,
            border: `2px solid ${theme.surface}`, background: p.avatar_url ? `center/cover url(${p.avatar_url})` : theme.surface2,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: theme.textMuted, boxSizing: "border-box",
          }}>
          {!p.avatar_url && (p.display_name?.[0] ?? "?")}
        </div>
      ))}
      {rest > 0 && (
        <div style={{ marginLeft: -8, width: 24, height: 24, borderRadius: "50%", border: `2px solid ${theme.surface}`, background: theme.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: theme.textMuted, boxSizing: "border-box" }}>
          +{rest}
        </div>
      )}
    </div>
  );
}
