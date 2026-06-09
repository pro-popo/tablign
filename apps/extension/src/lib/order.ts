/**
 * 현재 순서(id 배열)에서 insertId를 beforeLinkId 앞으로(없으면 맨 끝) 옮긴 새 순서를 만든다.
 * insertId가 이미 목록에 있으면 제거 후 재삽입(같은 목록 내 재정렬), 없으면 새로 삽입(탭/타 컬렉션 이동).
 */
export function placeInOrder(
  currentIds: string[],
  insertId: string,
  beforeLinkId: string | null,
): string[] {
  const ids = currentIds.filter((id) => id !== insertId);
  const idx = beforeLinkId && beforeLinkId !== insertId ? ids.indexOf(beforeLinkId) : -1;
  const at = idx >= 0 ? idx : ids.length;
  ids.splice(at, 0, insertId);
  return ids;
}

/**
 * 순서대로 1000 간격의 position을 부여한다(동일 position로 정렬이 무력화되는 문제 방지).
 */
export function sequentialPositions(orderedIds: string[]): { id: string; position: number }[] {
  return orderedIds.map((id, i) => ({ id, position: (i + 1) * 1000 }));
}
