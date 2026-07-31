import type { CSSProperties } from "react";

/** 아이콘 위치·크기 조정값의 기준 박스 크기(px). 저장된 오프셋은 이 크기 기준. */
export const ICON_REF_BOX = 100;
/** 박스 크기 대비 이모지 기준 글자 크기 비율(100%일 때). 모든 렌더 지점(레일·헤더·다이얼로그)이
 *  같은 비율을 써야 "설정한 크기"가 동일하게 보인다. 기본 이모지가 박스를 넉넉히 채우도록 잡음. */
const ICON_EMOJI_RATIO = 0.58;
/** 이모지 렌더 폰트 스택 — 토스페이스 1순위, 없으면 시스템 컬러 이모지로 fallback. 모든 렌더 지점 공통. */
export const ORG_ICON_FONT =
  '"Tossface", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
/** 개인 조직 기본 아이콘 — 커스텀 아이콘을 고르지 않았을 때 표시되는 집 이모지. */
export const PERSONAL_DEFAULT_ICON = "🏠";
/** 개인 조직 기본 색 — 커스텀 색을 고르지 않았을 때 아이콘 박스 배경(옐로우 그라데이션). 레일·헤더 공통. */
export const PERSONAL_DEFAULT_COLOR = "linear-gradient(135deg,#ffd43b,#f59f00)";

type IconTransform = { icon_scale?: number | null; icon_x?: number | null; icon_y?: number | null };

/** 스케일 확대 시 세로 드리프트 보정 계수(박스 대비).
 *  이모지는 baseline 기준이라 span 안에서 편차 δ만큼 위에 있고, scale(s)가 이를 δ×s로 증폭한다
 *  → 배율을 키울수록 위로 뜬다. 그 증폭분(= δ×(s−1))만 아래로 상쇄한다.
 *  scale 1에서는 항상 0이라 소형(레일·헤더)의 정중앙을 절대 건드리지 않고, 200%까지 위치를 유지한다.
 *  값은 실측 근사치(이모지 비율 0.68에 맞춤) — 필요 시 이 상수만 조정한다. */
const EMOJI_Y_SCALE_NUDGE = 0.048;

/** 저장된 스케일·오프셋을 렌더 박스 크기(boxSize)에 비례해 CSS transform 문자열로 변환. */
export function orgIconTransform(o: IconTransform, boxSize: number): string {
  const scale = (o.icon_scale ?? 100) / 100;
  const ratio = boxSize / ICON_REF_BOX;
  const x = (o.icon_x ?? 0) * ratio;
  // 기본 크기(scale 1)엔 보정 없음 — 소형 힌팅이 이미 중앙에 맞춘다. 확대분의 드리프트만 상쇄.
  const y = (o.icon_y ?? 0) * ratio + boxSize * EMOJI_Y_SCALE_NUDGE * (scale - 1);
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
