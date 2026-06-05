/** 새 항목 삽입 시 사용하는 기본 간격 */
export const GAP = 1000;

/**
 * 두 인접 항목의 position 사이에 들어갈 새 position을 계산한다.
 * before/after는 드롭 위치의 앞/뒤 항목 position (없으면 undefined).
 */
export function positionBetween(
  before: number | undefined,
  after: number | undefined,
): number {
  if (before === undefined && after === undefined) return GAP;
  if (before === undefined) return after! - GAP;
  if (after === undefined) return before + GAP;
  return (before + after) / 2;
}
