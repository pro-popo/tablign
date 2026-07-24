import type { CSSProperties } from "react";
import { orgIconStyle, PERSONAL_DEFAULT_ICON, PERSONAL_DEFAULT_COLOR } from "./orgIcon";

/** 색 미지정 팀 조직의 폴백 팔레트. org.id로 결정론적으로 골라
 *  레일·헤더 등 모든 렌더 지점이 같은 조직에 대해 같은 색을 쓰게 한다(리스트 순서와 무관). */
const TEAM_FALLBACK_COLORS = ["#20a97e", "#e8590c", "#7048e8", "#1098ad", "#e64980"];

function fallbackTeamColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % TEAM_FALLBACK_COLORS.length;
  return TEAM_FALLBACK_COLORS[h];
}

/** OrgIconBox가 필요로 하는 조직 필드(구조적 타입) — 저장된 조직/라이브 편집값 모두 수용. */
export interface OrgIconData {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  icon_scale?: number | null;
  icon_x?: number | null;
  icon_y?: number | null;
  is_personal?: boolean | null;
}

export interface OrgIconBoxProps {
  org: OrgIconData;
  /** 렌더 박스 한 변(px). 레일 32 · 헤더 28 · 다이얼로그 44. */
  size: number;
  /** 박스에 덧붙일 추가 스타일(예: 레일에서 위치 조정). */
  style?: CSSProperties;
}

/** 조직 아이콘 박스 — 레일·헤더·다이얼로그 공통. 크기만 다르고 모서리·색 폴백·이모지 렌더는 통일한다.
 *  이모지 글리프는 orgIconStyle(폰트·비율·세로 nudge)로, 박스는 size 비례 모서리(≈0.28)로 렌더한다. */
export function OrgIconBox({ org, size, style }: OrgIconBoxProps) {
  const isPersonal = !!org.is_personal;
  const bg = org.color ?? (isPersonal ? PERSONAL_DEFAULT_COLOR : fallbackTeamColor(org.id));
  const displayIcon = org.icon ?? (isPersonal ? PERSONAL_DEFAULT_ICON : null);
  return (
    <span
      aria-hidden="true"
      style={{
        boxSizing: "border-box",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        overflow: "hidden",
        background: bg,
        color: "#fff",
        fontSize: size * 0.42,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
        ...style,
      }}
    >
      {displayIcon ? (
        <span style={orgIconStyle(org, size)}>{displayIcon}</span>
      ) : (
        (org.name.trim().slice(0, 1) || "?").toUpperCase()
      )}
    </span>
  );
}
