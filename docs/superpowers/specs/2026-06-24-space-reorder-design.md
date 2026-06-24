# 스페이스 순서 변경 (드래그 앤 드롭)

날짜: 2026-06-24
대상: 확장(Extension) 새 탭 (`apps/extension`)

## 배경 / 목표

사이드바의 스페이스 순서를 사용자가 드래그로 바꿀 수 있게 한다. 컬렉션 순서 변경이 이미
같은 화면에 구현돼 있으므로, 동일한 dnd-kit 패턴을 스페이스에 복제해 UX를 일관되게 한다.
`ExtSidebar`는 이미 `NewTab`의 `DndContext` 안(`AppShell`의 `left` 슬롯)에 렌더되므로
**새 DndContext를 중첩하지 않고** 기존 컨텍스트에 스페이스를 sortable 항목으로 추가한다.
(중첩 컨텍스트는 포인터 이벤트 충돌 위험이 있어 피함.)

## 데이터 모델 (변경 없음)

- `spaces.position` — 이미 존재 (`createSpace`/`updateSpace`가 받음)
- `listSpaces`는 `position ASC` 정렬 — 이미 존재
- `updateSpace`는 `position` 패치를 받음 — 이미 존재
- → **DB 마이그레이션·core 변경 불필요.** 컬렉션과 동일하게 `sequentialPositions`로 position을 재할당한다.

## 변경 사항

### 1. 확장 — `ExtSidebar`
- 스페이스 목록을 `<SortableContext items={spaces.map(s => 'space:'+s.id)}
  strategy={verticalListSortingStrategy}>`로 감싼다.
- 각 스페이스 행을 `useSortable({ id: 'space:'+s.id, data: { kind: 'space', space } })`를 쓰는
  `SortableSpace` 래퍼로 렌더한다.
  - `setNodeRef`는 행 래퍼 div에, `listeners`/`attributes`(activator)는 선택 버튼에 연결한다
    (컬렉션 `SortableCollection`의 `setActivatorNodeRef` 패턴과 동일).
  - 드래그 중 `opacity: 0.5`, `transform`/`transition`은 sortable 값 사용.
  - id는 `space:` 접두사로 컬렉션(`col:`)·링크 UUID와 네임스페이스 분리.
- 클릭=선택 / 5px 이상 이동=재정렬 분리는 기존 `PointerSensor`의 `activationConstraint: { distance: 5 }`가 처리.
- rename(연필 hover) 흐름은 그대로 유지. 연필 버튼은 activator(선택 버튼)와 분리된 형제 요소라
  드래그 리스너의 영향을 받지 않음.
- 편집 중(`editingId === s.id`)인 행은 `InlineInput`만 렌더하므로 sortable 래핑 대상에서 제외(드래그 비활성).

### 2. 확장 — `NewTab` DnD 핸들러 (컬렉션 분기 미러링)
- `Active` 타입에 `{ type: 'space'; space: Space }` 추가.
- `spacesRef`(최신 순서), `spacesOriginRef`(취소·시작 스냅샷) ref 추가 — `collectionsRef`/`collectionsOriginRef`와 동일.
- `collisionDetection`: active `kind === 'space'`이면 `space:`로 시작하는 droppable만 후보로 한정
  (컬렉션 `col:` 분기와 동일).
- `handleDragStart`: space 분기 → `spacesOriginRef`에 시작 순서 스냅샷 + `setActive`.
- `handleDragOver`: space 분기 → over가 다른 `space:`이면 `spaces`를 `arrayMove`로 실시간 재정렬
  (`setSpaces` + `spacesRef`).
- `handleDragEnd`: space 분기 → 최신 순서로 `sequentialPositions(ids)` 계산 →
  `Promise.all(updateSpace(supabase, id, { position }))`. 로컬 순서는 이미 반영돼 있어 재조회 불필요.
- `handleDragCancel`: space면 `spacesOriginRef`로 복원.
- `DragOverlay`: 드래그 중 space면 이름 칩 미리보기 렌더(컬렉션 칩과 동일 스타일).

## 엣지 케이스

- 스페이스 0~1개: 드래그해도 이동 결과 없음(무해).
- `activeSpaceId`는 id 기반이라 순서가 바뀌어도 활성 스페이스 유지.
- 재정렬은 `spaces`만 건드리고 컬렉션 로드를 트리거하지 않으므로 보드 스켈레톤 깜빡임 없음.
- 드래그 중 컬렉션/링크/탭과 스페이스가 섞이지 않도록 collision detection이 kind로 분리.

## 테스트

- 순서 계산은 기존 순수 헬퍼(`sequentialPositions`, 이미 테스트됨)를 재사용 — 신규 순수 로직 없음.
- 타입체크(`pnpm --filter ./apps/extension exec tsc --noEmit`)로 wiring 검증.
- 확장 기존 테스트(`pnpm --filter ./apps/extension test`) 통과 유지 확인.
- 확장 새 탭에서 수동 검증: 스페이스 드래그로 이동 → 새로고침 후 순서 유지.
