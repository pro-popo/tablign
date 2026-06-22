# 열린 탭 패널 — 창별 접기/펼치기 설계

## 배경

열린 탭 패널(`OpenTabsPanel`)은 브라우저 창을 `창 1`, `창 2` … 단위로 그룹화해 보여준다.
창마다 탭이 많으면 패널이 길어져, 창 단위로 접어 한눈에 정리할 수 있게 한다.
헤더에 이미 비활성 상태의 `ChevronDown` 아이콘이 있어 이를 토글로 연결한다.

## 요구사항

- 창 헤더(`창 N`) 행 전체를 클릭하면 해당 창의 탭 목록이 접히거나 펼쳐진다.
- 펼침일 때 `ChevronDown`, 접힘일 때 `ChevronRight` 아이콘을 표시한다.
- 접혔을 때 탭 개수를 헤더에 작게 표시한다(예: `창 1 · 5`).
- 저장(Download)·닫기(X) 버튼 클릭은 접기/펼치기 토글을 발동하지 않는다.
- 접힘 상태는 영속화하지 않는다(메모리 전용). 모든 창은 펼쳐진 상태로 시작한다.

### 영속화하지 않는 이유

Chrome `windowId`는 세션마다 바뀌므로 저장해도 재시작 후 매칭되지 않는다.
따라서 `useState` 로컬 상태만으로 충분하다.

## 설계

수정 범위는 `apps/extension/src/newtab/OpenTabsPanel.tsx`의 `WindowGroupView` 한 곳뿐이다.
접힘 상태가 컴포넌트 로컬에만 머물므로 `OpenTabsPanel` / `NewTab`의 props 변경은 없다.

1. `WindowGroupView`에 `const [collapsed, setCollapsed] = useState(false)` 추가.
2. 창 헤더 `div`에 `onClick`(토글), `cursor: pointer`, `role="button"`, `aria-expanded={!collapsed}` 부여.
3. 저장·닫기 버튼 `onClick`에 `e.stopPropagation()` 추가.
4. 아이콘: `collapsed ? <ChevronRight/> : <ChevronDown/>`. import에 `ChevronRight` 추가.
5. `collapsed`일 때 탭 개수 `· {group.tabs.length}`를 헤더에 표시.
6. `collapsed`일 때 `<SortableContext>` 블록을 렌더하지 않는다(접힌 창은 드롭 대상 아님).

## 테스트 (`OpenTabsPanel.test.tsx`)

- 창 헤더 클릭 → 해당 창 탭이 숨겨짐. 다시 클릭 → 탭이 다시 보임.
- 저장/닫기 버튼 클릭 → 토글이 발동하지 않음(탭 목록 유지, 콜백만 호출).
