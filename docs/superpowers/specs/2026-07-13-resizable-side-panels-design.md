# 사이드 패널 드래그 리사이즈

## 배경 / 문제

`AppShell`의 좌/우 사이드 패널은 각각 212px, 272px로 폭이 고정돼 있다. 스페이스 목록이나 열린 탭 제목이 길면 잘리고, 사용자가 화면 비중을 조절할 수 없다. 패널 안쪽 경계를 드래그해 폭을 자유롭게 늘리고, 최소/최대 범위 안에서만 움직이도록 한다.

## 요구사항

- 좌·우 패널 모두 안쪽 경계를 드래그해 폭 조절.
- 폭 범위: **양쪽 공통 `[180, 400]`px**. 기본 폭은 현재값 유지(좌 212, 우 272).
- 조절한 폭은 세션 간 **기억**(열림/닫힘과 동일한 영속화 경로).
- 리사이즈 핸들은 평소 숨겨져 있고, **호버 시 강조**(accent 라인 + `col-resize` 커서).
- 패널이 **열려 있을 때만** 리사이즈 가능(레일 상태에서는 불가).

## 아키텍처

기존 `usePanelState` 훅(열림/닫힘 상태를 플랫폼 어댑터로 영속화)을 확장해 폭도 같은 storage 키에 함께 저장한다. `AppShell`은 폭 값을 prop으로 받아 렌더하고, 드래그 상호작용을 담당한다. `AppShell`은 `packages/ui`에 있어 `chrome.storage`에 직접 접근하지 않는다(플랫폼 어댑터 패턴 유지).

### 1. `packages/ui/src/usePanelState.ts`

- `PanelState`에 `leftWidth: number`, `rightWidth: number` 추가.
- `DEFAULT = { left: true, right: true, leftWidth: 212, rightWidth: 272 }`.
- `isPanelState`: `left`/`right`(boolean)만 필수 검증. 폭 필드는 **선택적** — 없거나 숫자가 아니면 유효로 보되 복원 시 기본값으로 보정한다(하위호환: 폭 개념이 없던 기존 저장값도 그대로 통과).
- 복원 로직: `read`로 받은 값에서 폭 필드가 유효한 숫자면 사용하고, 아니면 `DEFAULT`의 폭을 쓴다. 복원값도 `[MIN, MAX]`로 클램프한다.
- 신규 함수 `setLeftWidth(w)`, `setRightWidth(w)`: `[MIN, MAX]`로 클램프 후 상태 갱신 + `storage.write`.
- `MIN_PANEL_WIDTH = 180`, `MAX_PANEL_WIDTH = 400` 상수를 export(테스트·AppShell 공용).

### 2. `packages/ui/src/AppShell.tsx`

- Props 추가: `leftWidth: number`, `rightWidth: number`, `onResizeLeft: (w: number) => void`, `onResizeRight: (w: number) => void`.
- `panel()` 헬퍼의 열림 폭을 상수(212/272) 대신 prop 값으로 사용.
- 각 `aside`가 열려 있을 때 안쪽 경계에 리사이즈 핸들을 렌더:
  - 좌 패널: 오른쪽 경계(`right: 0`), 우 패널: 왼쪽 경계(`left: 0`).
  - 절대 위치, 너비 ~6px, 전체 높이, `cursor: col-resize`, `zIndex`로 콘텐츠 위.
  - 평소 배경 투명, 호버 시 안쪽 1~2px에 `theme.accent` 라인 표시.
- 드래그 처리(핸들의 포인터 이벤트):
  - `onPointerDown`: `setPointerCapture(e.pointerId)`, 시작 `clientX`와 시작 폭 기록, `dragging` 상태 on.
  - `onPointerMove`(캡처 중): delta = `clientX - startX`. 좌 패널 `startWidth + delta`, 우 패널 `startWidth - delta`. 결과를 `onResizeLeft/Right`로 전달(클램프는 훅 setter가 수행).
  - `onPointerUp` / `onLostPointerCapture`: `dragging` off, 캡처 해제.
- `dragging` 중에는 패널의 `width transition`을 끈다(열기/닫기 애니메이션과 드래그 랙 분리).

### 3. `apps/extension/src/newtab/NewTab.tsx`

- `usePanelState()`에서 `state.leftWidth`, `state.rightWidth`, `setLeftWidth`, `setRightWidth`를 받아 `AppShell`에 전달.

### 4. `apps/extension/src/lib/usePanelState.ts`

- 어댑터는 그대로. `isPanelState`가 폭 필드를 선택적으로 다루므로 chrome.storage 어댑터 수정 불필요.

## 데이터 흐름

1. 마운트 시 훅이 `storage.read`로 저장값 복원 → 폭 필드 보정·클램프.
2. 사용자가 핸들 드래그 → `AppShell`이 실시간 폭 계산 → `onResize*` → 훅 setter가 클램프·상태 갱신·`storage.write`.
3. `AppShell`이 새 폭으로 리렌더. 다음 세션에서 복원.

## 엣지 케이스

- 폭 필드 없는 기존 저장값: 기본 폭으로 보정, 크래시 없음.
- 범위 밖 저장값(수동 조작 등): 복원 시 클램프.
- 패널 닫힘(레일): 핸들 미렌더 → 드래그 불가.
- 매우 좁은 창: `main`이 `flex:1 minWidth:0`이라 콘텐츠가 줄어듦. 패널은 자기 범위 유지.

## 테스트

- `usePanelState.test`(packages/ui):
  - 폭 저장 후 복원.
  - `setLeftWidth/setRightWidth` 클램프(<180 → 180, >400 → 400).
  - 하위호환: 폭 없는 저장값 → 기본 폭으로 복원.
- `AppShell.test`(packages/ui):
  - 패널 열림 시 리사이즈 핸들 렌더, 닫힘 시 미렌더.
  - 핸들 포인터 드래그 시 `onResizeLeft/Right`가 예상 폭으로 호출.

## 범위 밖 (YAGNI)

- 더블클릭으로 기본 폭 리셋.
- 패널 폭 프리셋/스냅.
- 키보드로 폭 조절.
</content>
</invoke>
