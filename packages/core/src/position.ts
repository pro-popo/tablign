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

/**
 * 현재 순서(id 배열)에서 insertId를 beforeId 앞으로(없으면 맨 끝) 옮긴 새 순서를 만든다.
 * insertId가 목록에 있으면 제거 후 재삽입(재정렬), 없으면 새로 삽입(타 컨테이너 이동).
 */
export function placeInOrder(currentIds: string[], insertId: string, beforeId: string | null): string[] {
  const ids = currentIds.filter((id) => id !== insertId);
  const idx = beforeId && beforeId !== insertId ? ids.indexOf(beforeId) : -1;
  const at = idx >= 0 ? idx : ids.length;
  ids.splice(at, 0, insertId);
  return ids;
}

/** 순서대로 GAP 간격의 position을 부여한다(동일 position로 정렬이 무력화되는 문제 방지). */
export function sequentialPositions(orderedIds: string[]): { id: string; position: number }[] {
  return orderedIds.map((id, i) => ({ id, position: (i + 1) * GAP }));
}
