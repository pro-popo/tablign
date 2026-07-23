import type { CSSProperties } from "react";

/** 아이콘 위치·크기 조정값의 기준 박스 크기(px). 저장된 오프셋은 이 크기 기준. */
export const ICON_REF_BOX = 100;
/** 박스 크기 대비 이모지 기준 글자 크기 비율. 다이얼로그 프리뷰(박스 44 / 이모지 25 ≈ 0.57) 기준으로
 *  레일·헤더 등 모든 렌더 지점에서 같은 비율을 써야 "설정한 크기"가 동일하게 보인다. */
const ICON_EMOJI_RATIO = 0.57;
/** 이모지 렌더 폰트 스택 — 토스페이스 1순위, 없으면 시스템 컬러 이모지로 fallback. 모든 렌더 지점 공통. */
export const ORG_ICON_FONT =
  '"Tossface", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

type IconTransform = { icon_scale?: number | null; icon_x?: number | null; icon_y?: number | null };

/** 저장된 스케일·오프셋을 렌더 박스 크기(boxSize)에 비례해 CSS transform 문자열로 변환. */
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
