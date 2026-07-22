import type { CSSProperties } from "react";

/** 아이콘 위치·크기 조정값의 기준 박스 크기(px). 저장된 오프셋은 이 크기 기준. */
export const ICON_REF_BOX = 100;

type IconTransform = { icon_scale?: number | null; icon_x?: number | null; icon_y?: number | null };

/** 저장된 스케일·오프셋을 렌더 박스 크기(boxSize)에 비례해 CSS transform 문자열로 변환. */
export function orgIconTransform(o: IconTransform, boxSize: number): string {
  const scale = (o.icon_scale ?? 100) / 100;
  const ratio = boxSize / ICON_REF_BOX;
  const x = (o.icon_x ?? 0) * ratio;
  const y = (o.icon_y ?? 0) * ratio;
  return `translate(${x}px, ${y}px) scale(${scale})`;
}

/** 조직 이모지를 감싸는 span 스타일 — 박스 안에서 transform으로 위치·크기 조정. */
export function orgIconStyle(o: IconTransform, boxSize: number): CSSProperties {
  return { display: "inline-flex", transform: orgIconTransform(o, boxSize), willChange: "transform" };
}
