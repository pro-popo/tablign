# 컬렉션 순서 변경 (드래그 핸들)

날짜: 2026-06-23
대상: 확장(Extension) 새 탭 (`apps/extension`)

## 배경 / 목표

새 탭 보드의 컬렉션 순서를 사용자가 드래그로 바꿀 수 있게 한다. 링크/탭 드래그는 이미
동작하므로, 같은 `DndContext`에 컬렉션 정렬을 추가한다. 컬렉션 헤더의 **전용 그립 핸들**로만
잡아 옮겨, 이름 편집 클릭·링크 카드 드래그와 충돌하지 않게 한다.

## 데이터 모델 (변경 없음)

- `collections.position double precision NOT NULL DEFAULT 1000` — 이미 존재
- `listCollections`는 `position ASC` 정렬 — 이미 존재
- `updateCollection`은 `position` 패치를 받음 — 이미 존재
- → **DB 마이그레이션 불필요.** 링크와 동일하게 1000 간격 position을 재할당한다.

## 변경 사항

### 1. `@tablign/ui`
- `icons.ts`: `GripVertical` export 추가.
- `CollectionSection.tsx`: `dragHandleSlot?: ReactNode` prop 추가. 헤더 맨 왼쪽(접기
  화살표 앞)에 렌더. UI 패키지는 DnD를 알지 못하고, 확장이 sortable 핸들을 주입한다
  (기존 `linksSlot` 주입 패턴과 동일). slot 미제공 시 아무것도 렌더하지 않음(웹 영향 없음).

### 2. 확장 — `SortableCollection` 래퍼
`DndLinkList`의 `SortableCard`와 같은 방식의 래퍼(NewTab 또는 신규 파일).
- `useSortable({ id: 'col:' + collection.id, data: { kind: 'collection', collection } })`
- 그립 아이콘 버튼에 `listeners`/`attributes`를 연결해 `dragHandleSlot`으로 전달.
- 드래그 중 `opacity: 0.5`, `transform`/`transition`은 sortable 값 사용.
- id는 `col:` 접두사로 링크 UUID와 네임스페이스 분리.

### 3. 확장 — Board 렌더
컬렉션 `map`을 `<SortableContext items={collections.map(c => 'col:'+c.id)}
strategy={verticalListSortingStrategy}>`로 감싼다.

### 4. 확장 — DnD 핸들러
- `collisionDetection`을 kind 인지형으로: active의 `data.current.kind === 'collection'`이면
  `col:`로 시작하는 droppable만 후보로 한정, 그 외엔 기존 카드 우선 로직 유지. active kind는
  `handleDragStart`에서 ref에 보관해 collision 함수가 읽는다.
- `Active` 타입에 `{ type: 'collection'; collection: Collection }` 추가.
- `handleDragStart`: collection 분기 → 시작 순서 스냅샷(ref) + `setActive`.
- `handleDragOver`: collection 분기 → over가 다른 `col:`이면 `collections`를 `arrayMove`로
  실시간 재정렬.
- `handleDragEnd`: collection 분기 → 최신 순서로 `sequentialPositions(ids)` 계산 →
  `Promise.all(updateCollection(supabase, id, { position }))` → `loadCollections()`.
- `handleDragCancel`: collection이면 스냅샷으로 복원.
- `DragOverlay`: 드래그 중 컬렉션이면 제목 칩 미리보기 렌더.

## 엣지 케이스

- 핸들은 제목(이름 편집)·접기 버튼과 분리된 별도 요소이며 클릭 이벤트는 `stopPropagation`.
- 컬렉션 0~1개: 핸들은 보이되 이동 결과가 없음(무해).
- 드롭 후 `loadCollections()`는 `collectionsLoaded`를 건드리지 않으므로 스켈레톤 깜빡임 없음.
- 드래그 중 링크/탭과 컬렉션이 섞이지 않도록 collision detection이 kind로 분리.

## 테스트

- 순서 계산은 기존 순수 헬퍼(`placeInOrder`/`sequentialPositions`, 이미 테스트됨)를 재사용.
- 타입체크(`pnpm --filter @tablign/extension lint`)로 wiring 검증.
- 확장 새 탭에서 수동 검증: 핸들로 컬렉션 이동 → 새로고침 후 순서 유지.
