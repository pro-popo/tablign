import type { CSSProperties } from "react";

/** 아이콘 위치·크기 조정값의 기준 박스 크기(px). 저장된 오프셋은 이 크기 기준. */
export const ICON_REF_BOX = 100;
/** 박스 크기 대비 이모지 기준 글자 크기 비율. 다이얼로그 프리뷰(박스 44 / 이모지 25 ≈ 0.57) 기준으로
 *  레일·헤더 등 모든 렌더 지점에서 같은 비율을 써야 "설정한 크기"가 동일하게 보인다. */
const ICON_EMOJI_RATIO = 0.57;
/** 이모지 렌더 폰트 스택 — 토스페이스 1순위, 없으면 시스템 컬러 이모지로 fallback. 모든 렌더 지점 공통. */
export const ORG_ICON_FONT =
  '"Tossface", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
/** 개인 조직 기본 아이콘 — 커스텀 아이콘을 고르지 않았을 때 표시되는 집 이모지. */
export const PERSONAL_DEFAULT_ICON = "🏠";
/** 개인 조직 기본 색 — 커스텀 색을 고르지 않았을 때 아이콘 박스 배경(옐로우 그라데이션). 레일·헤더 공통. */
export const PERSONAL_DEFAULT_COLOR = "linear-gradient(135deg,#ffd43b,#f59f00)";

type IconTransform = { icon_scale?: number | null; icon_x?: number | null; icon_y?: number | null };

/** 저장된 스케일·오프셋을 렌더 박스 크기(boxSize)에 비례해 CSS transform 문자열로 변환.
 *  ※ 세로 중앙 보정 nudge는 두지 않는다: 실제 사용 크기(28·32·44px)에서 토스 글리프는 힌팅이
 *  중앙에 스냅시켜 nudge가 오히려 소형(레일·헤더)을 어긋나게 했다(박스 비례 상수로는 세 크기 동시 보정 불가). */
export function orgIconTransform(o: IconTransform, boxSize: number): string {
  const scale = (o.icon_scale ?? 100) / 100;
  const ratio = boxSize / ICON_REF_BOX;
  const x = (o.icon_x ?? 0) * ratio;
  const y = (o.icon_y ?? 0) * ratio;
  return `translate(${x}px, ${y}px) scale(${scale})`;
}

/** 조직 이모지를 감싸는 span 스타일 — 박스 안에서 transform으로 위치·크기 조정.
 *  기준 글자 크기도 박스 크기에 비례해 지정하여, 렌더 지점(레일·헤더·다이얼로그)마다 이모지-박스 비율을 통일한다. */
export function orgIconStyle(o: IconTransform, boxSize: number): CSSProperties {
  return {
    display: "inline-flex",
    fontFamily: ORG_ICON_FONT,
    // 반올림하지 않는다 — 렌더 지점(레일 32·헤더 28·다이얼로그 44)마다 글자/박스 비율을 정확히 0.57로 통일해야
    // 이모지 글리프의 baseline 위치가 박스 대비 동일하게 맞는다(반올림 시 0.5625 vs 0.571로 미세하게 어긋남).
    fontSize: boxSize * ICON_EMOJI_RATIO,
    lineHeight: 1,
    transform: orgIconTransform(o, boxSize),
    willChange: "transform",
  };
}
