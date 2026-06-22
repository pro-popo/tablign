# 열린 탭 창 간 이동 (드래그 앤 드롭) 설계

날짜: 2026-06-21

## 목표

"열린 탭"(OpenTabsPanel) 패널에서 탭을 드래그해 **다른 창의 특정 위치로 이동**하고,
**같은 창 내 재정렬**도 가능하게 한다. 실제 브라우저 탭을 옮기는 동작이므로
`chrome.tabs.move`를 사용한다.

기존의 "탭 → 컬렉션 저장"(보드 영역에 드롭 시 링크로 저장) 동작은 그대로 유지한다.
보드(컬렉션)와 우측 패널(창 목록)이 공간적으로 분리되어 있어 두 드롭 동작이 자연스럽게 공존한다.

## 배경 (현재 상태)

- `apps/extension/src/newtab/OpenTabsPanel.tsx`: 탭을 `windowId`로 그룹화해 "창 1", "창 2"로
  표시. 각 탭 행은 `useDraggable`로 드래그 가능하지만, **유일한 드롭 대상은 컬렉션**이며
  드롭 시 링크로 저장된다. 창 그룹 자체는 드롭 타깃이 아니다.
- `apps/extension/src/lib/tabs.ts`: `WindowTab` / `WindowGroup` 타입과
  `groupTabsByWindow()` 그룹화 함수.
- `apps/extension/src/newtab/NewTab.tsx`: `DndContext` 오케스트레이션. `handleDragStart` /
  `handleDragOver` / `handleDragEnd` / `handleDragCancel`. 탭 드래그 시 컬렉션에
  자리표시 카드(`NEW_TAB_PLACEHOLDER` = `__newtab__`)를 실시간 삽입하고, 드롭 시
  `createLink`로 저장한다. `chrome.tabs.move`는 현재 전혀 사용하지 않는다.
- 컬렉션 DnD는 `@dnd-kit/sortable`의 `useSortable` + `arrayMove` 실시간 미리보기 패턴을
  이미 사용 중이다. 본 기능은 이 검증된 패턴을 창/탭에 확장한다.

## 결정 사항

- **이동 정밀도**: 정확한 위치 지정 + 같은 창 내 재정렬 모두 지원.
- **비-http 탭**: chrome:// 등을 포함한 **모든 탭**의 창 간 이동 허용 (실제 브라우저 탭을
  옮기는 것이므로 http 필터를 적용하지 않는다). 단, 컬렉션 저장은 기존대로 http(s)만.
- **구현 접근**: 기존 컬렉션 DnD 패턴(`useSortable` + 실시간 `arrayMove`)을 창/탭에 그대로 확장.

## 설계

### 1) `OpenTabsPanel.tsx` — 창을 드롭 타깃으로, 탭을 sortable로

- `TabRow`를 `useDraggable` → **`useSortable`**로 전환. drag id는 기존과 동일하게
  `tab-{tab.id}`, data는 `{ kind: "tab", tab }` 유지. `isDragging` 시 opacity 등 시각
  처리도 유지.
- 각 창 그룹을 **droppable 컨테이너** `window:{windowId}`로 만든다 (`useDroppable`).
  빈 창에도 드롭 가능하도록 컨테이너 droppable을 항상 유지한다.
- 각 창의 탭 목록을 `SortableContext`(해당 창의 `tab-{id}` 배열, `verticalListSortingStrategy`
  또는 기존 컬렉션과 동일 전략)로 감싼다.
- 시각 피드백: 드래그 중 자리가 부드럽게 벌어지는 실시간 미리보기 — 컬렉션과 동일.

### 2) `tabs.ts` — 순수 재배치 로직

```
moveTab(groups: WindowGroup[], tabId: number, toWindowId: number, toIndex: number): WindowGroup[]
```

- 드래그 중 `groups` 상태를 실시간으로 재배치하는 순수 함수.
- 동작: 원본에서 해당 탭을 찾아 제거하고, `toWindowId` 그룹의 `toIndex` 위치에 삽입한다.
  같은 창이면 재정렬, 다른 창이면 창 간 이동. `toIndex`가 길이 이상이면 끝에 추가.
- 순수 함수로 두어 단위 테스트가 쉽도록 한다(기존 `tabs.test.ts` 패턴).

### 3) `NewTab.tsx` — DnD 오케스트레이션 확장

- **refs 추가**:
  - `groupsRef`: `groups`의 최신값 미러 (`linksByColRef`와 동일 목적, `handleDragEnd`에서
    드래그 중 갱신된 최신 그룹 상태를 읽기 위함).
  - `groupsOriginRef`: `handleDragStart` 시점의 원본 `groups` 스냅샷. 드래그 대상이
    창 → 컬렉션으로 전환될 때 그룹 상태를 원본으로 복원하는 데 사용.

- **`handleDragStart`**: 탭 드래그 시작 시 `groupsOriginRef`에 현재 `groups` 스냅샷 저장
  (기존 `dragOriginRef`/`setActive` 로직은 유지).

- **`handleDragOver`** (탭 드래그일 때 `over` 대상으로 분기):
  - 대상이 **창**(overId가 `window:`로 시작하거나, `groups` 안의 `tab-{id}`)이면:
    - `moveTab`으로 `groups`를 실시간 재배치.
    - 혹시 컬렉션에 삽입돼 있던 `NEW_TAB_PLACEHOLDER`가 있으면 제거(linksByCol 정리).
  - 대상이 **컬렉션**(overId가 `container:`로 시작하거나 링크 카드 id)이면:
    - 기존 자리표시(`NEW_TAB_PLACEHOLDER`) 삽입 로직 그대로 수행.
    - `groups`는 `groupsOriginRef` 스냅샷으로 복원 (창에서 가져갔던 탭을 되돌림).
  - 링크 드래그 분기는 기존 로직 그대로 유지.

- **`handleDragEnd`** (탭 드래그일 때):
  - `over`가 **창**이면: `groupsRef`에서 대상 창과 그 안에서의 탭 최종 index를 계산해
    `chrome.tabs.move(tabId, { windowId: toWindowId, index })` 호출.
    이후 `chrome.tabs.query({})` 재조회 → `groupTabsByWindow`로 그룹 갱신
    (인덱스 드리프트/실제 브라우저 상태와 동기화).
  - `over`가 **컬렉션**이면: 기존 `createLink` 저장 동작 그대로.
  - 링크 분기는 기존 로직 그대로.

- **`handleDragCancel`**: 탭의 경우 그룹을 원복(또는 `chrome.tabs.query` 재조회)하고
  `active`/`dragOverCol` 초기화 (기존 동작과 일관).

- **`collisionDetection`**: 창 컨테이너(`window:`)/창 안 탭과 기존 컬렉션 컨테이너/카드를
  모두 인식하도록 보강. 카드(탭/링크) 우선, 컨테이너 후순위 기존 정책 유지.

### 4) 동작 규칙

- 이동 후 항상 `chrome.tabs.query`로 재조회해 화면이 실제 브라우저 상태와 일치하도록 한다.
- 고정(pinned)/특수 탭은 Chrome이 `index`를 자동 보정한다 — 별도 처리 없이 우아하게 동작.
  (엣지 케이스로 인지만 하고 특별 분기는 두지 않는다.)
- `chrome.tabs.move`의 `index`는 0-based, 끝으로 보낼 때는 계산된 길이 또는 -1.

## 테스트

- `tabs.test.ts`:
  - `moveTab` 같은 창 내 재정렬 (앞→뒤, 뒤→앞).
  - `moveTab` 다른 창으로 이동 (특정 index 삽입).
  - `moveTab` 창의 끝으로 이동.
  - `moveTab` 빈 창으로 이동.
- `OpenTabsPanel.test.tsx`:
  - 각 창 그룹이 droppable(`window:{windowId}`)로 렌더링되는지.
  - 탭 행이 sortable로 렌더링되는지.

## 영향 범위 / 비목표

- 영향: `OpenTabsPanel.tsx`, `tabs.ts`, `NewTab.tsx` (+ 두 테스트 파일).
- 비목표: 탭 그룹(Chrome tab groups) 지원, 새 창 생성 드롭존, 탭 핀/언핀 토글,
  컬렉션 저장 동작의 변경.
