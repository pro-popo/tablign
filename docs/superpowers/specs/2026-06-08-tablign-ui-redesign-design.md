# tablign — UI/UX 리디자인 ("Studio") 설계

작성일: 2026-06-08

## 개요

현재 웹 대시보드와 크롬 확장 새 탭 페이지는 기능은 동작하지만 시각적으로 투박하고
(인라인 스타일·이모지 아이콘·`prompt()` 기반 입력) UX가 불편하다. 토비(gettoby.com)
수준의 정돈된 3단 레이아웃으로 리디자인하고, 확장 새 탭에는 **현재 열린 브라우저
탭("OPEN TABS") 패널**을 추가해 탭을 드래그로 컬렉션에 저장할 수 있게 한다.

확정된 방향은 **"Studio"**: 라이트 배경 + 인디고(`#3b5bdb`) 단일 강조색, Lucide
라인 아이콘, 1px 미세 구분선, 좌/우 사이드 패널 접기/펼치기.

## 목표

- **디자인 시스템 기초**: `@tablign/ui`에 디자인 토큰(색·간격·반경)과 Lucide 아이콘 도입,
  공용 컴포넌트(LinkCard, Card, 버튼/아이콘버튼, Toast)를 "Studio" 룩으로 재정비.
- **3단 앱 셸(AppShell)**: 좌 사이드바 / 중앙 보드 / 우 패널. 좌·우 패널 접기/펼치기,
  접힘 상태 영속화(웹=localStorage, 확장=chrome.storage.local).
- **그룹형 보드**: 활성 스페이스의 각 컬렉션을 "섹션"(헤더 + 링크 카드 그리드)으로 표시.
  섹션별 접기 + 전체 펼치기/접기. (기존 세로 컬럼 방식 대체)
- **OPEN TABS 패널(확장 전용)**: 현재 창·탭을 창별로 그룹화해 표시, 탭을 드래그해
  컬렉션 섹션에 저장, "창 전체 저장", 탭 닫기.
- **UX 개선**: `prompt()`/`alert()` 제거 → 인라인 입력 + 토스트 피드백 + 빈/로딩 상태.
- 웹 대시보드와 확장 새 탭이 동일한 셸·보드·카드를 공유(웹은 OPEN TABS 제외).

## 비목표 (이번 리디자인 제외)

- 새로운 데이터 기능(태그/검색/동기화는 이미 구현됨 — 시각만 새 룩에 맞춤).
- 다크 모드(후속). "VIEW"(카드/리스트 전환), 컬렉션 커버 이미지(후속).
- 컬럼 내 임의 위치 재정렬(드롭은 기존처럼 섹션 단위) — 별도 과제.
- 모바일 반응형 정밀 대응(데스크톱 우선; 좁아지면 패널 자동 접힘 정도만).

## 디자인 토큰

`@tablign/ui`에 라이트 테마 토큰을 정의(초기엔 TS 상수 + 인라인/스타일 객체, 또는
CSS 변수). 색상:

| 용도 | 값 |
|---|---|
| accent (강조) | `#3b5bdb` |
| accent-weak (선택 배경) | `#edf0fe` |
| text | `#1f2430` |
| text-muted | `#868e96` |
| text-faint | `#adb5bd` |
| border | `#eaecef` |
| border-card | `#e9ebee` |
| bg (앱 배경) | `#fcfcfd` |
| surface (카드/패널) | `#ffffff` |
| surface-2 (입력/호버) | `#f1f3f5` |
| danger | `#e03131` |

간격 스케일 4/6/8/10/12/14/16/20, 반경 카드 9px·버튼 7px·패널 0(직각 분리)·칩 8px.
폰트: 시스템 UI 스택. 아이콘: `lucide-react`(웹·확장 공통).

## 아키텍처 / 컴포넌트

공용 컴포넌트는 `@tablign/ui`에 두고 웹·확장이 공유한다. 데이터 접근/훅은 기존
`@tablign/core`·웹 `queries.ts`를 그대로 사용(시각/구성만 변경).

### `@tablign/ui` (재정비 + 신규)
```
theme.ts            디자인 토큰 상수
icons.ts            lucide-react 재export(사용 아이콘 모음)
AppShell.tsx        3단 셸: left/right 슬롯 + 접기 상태 제어(props 기반)
  ├─ SidePanel       접기 가능한 좌/우 컨테이너(헤더 + 접기 버튼 + 내용)
Board.tsx           세로 스크롤 보드 컨테이너(섹션 나열) — 기존 가로 Board 대체
CollectionSection.tsx  컬렉션 1개 = 헤더(제목·개수·접기·OpenAll·메뉴) + LinkCard 그리드 + 링크추가
LinkCard.tsx        파비콘+제목+도메인, hover 시 열기/삭제, 클릭=열기 (재스타일)
Favicon.tsx         파비콘 이미지 + 실패 시 Lucide globe 폴백
Card / IconButton / Button / Toast / EmptyState / InlineInput  (소형 프리미티브)
```
- 기존 `CollectionColumn`(세로 컬럼)은 `CollectionSection`(가로 헤더+그리드)으로 대체.
  `CollectionColumn`은 제거(웹·확장 모두 섹션형으로 통일).
- `AppShell`은 표시 전용: 접힘 상태와 토글 콜백을 props로 받는다(영속화는 앱이 담당).

### 웹 (`apps/web`)
```
app/dashboard/DashboardClient.tsx   AppShell 사용: 좌=Sidebar, 중앙=Board(섹션들), 우=없음(또는 안내)
lib/usePanelState.ts                localStorage 기반 좌/우 접힘 상태 훅
components/Sidebar.tsx              스페이스·검색·태그 필터(좌 패널 내용; lucide 아이콘)
components/Toolbar.tsx              상단 바: 스페이스명·개수·태그·＋컬렉션·전체펼치기/접기
```
- 검색바·태그필터·드래그앤드롭(@dnd-kit)·Realtime은 기존 로직 유지, 새 컴포넌트에 연결.
- `prompt()` 제거: ＋컬렉션/＋스페이스/＋링크는 인라인 입력(InlineInput)으로.

### 확장 (`apps/extension`)
```
src/newtab/NewTab.tsx        AppShell 사용: 좌=Sidebar(간소), 중앙=Board, 우=OpenTabsPanel
src/newtab/OpenTabsPanel.tsx 창별 그룹 + 탭 행(드래그 소스) + 창전체저장/탭닫기
src/lib/tabs.ts              (확장) groupTabsByWindow 등 순수 함수 추가
src/lib/usePanelState.ts     chrome.storage.local 기반 접힘 상태 훅
```
- OPEN TABS는 `chrome.windows.getAll({ populate: true })` 또는 `chrome.tabs.query({})` +
  `windowId` 그룹화로 구성. 탭 행은 `@dnd-kit` draggable, 컬렉션 섹션이 droppable.
- 드롭 시 `tabsToLinkInputs([tab], userId, collectionId)` → `createLink`로 저장(토스트).
- "창 전체 저장": 새 컬렉션 생성 후 해당 창 http(s) 탭 일괄 저장(부분 실패 처리 유지).
- "탭 닫기": `chrome.tabs.remove(tabId)` 후 목록 갱신. 팝업(Popup)도 같은 룩으로 소폭 정리.

## 상호작용 / UX

- **패널 접기**: 좌/우 헤더의 접기 아이콘(panel-left/right). 좌 접힘 → 48px 슬림 아이콘
  레일(스페이스 아이콘 + 펼치기 버튼). 우 접힘 → 완전 숨김 + 중앙 상단에 "열린 탭" 재오픈
  버튼. 상태는 영속화.
- **드래그앤드롭**: (a) 링크 카드를 다른 컬렉션 섹션으로 이동, (b) OPEN TABS 탭을 섹션에
  드롭해 저장. 드롭 대상 섹션은 hover 시 강조(accent-weak 배경 + 점선 테두리).
- **인라인 생성**: 버튼 클릭 시 그 자리에서 입력 필드가 열리고 Enter로 확정, Esc로 취소.
- **피드백**: 저장/이동/삭제/오류를 Toast로 알림(우하단). 낙관적 업데이트 유지.
- **빈/로딩 상태**: 컬렉션 0개·링크 0개·열린 탭 0개 각각 안내 문구 + 행동 유도.
- **아이콘**: 모든 이모지를 Lucide로 교체(Search, Hash, Tag, Plus, PanelLeft/Right,
  ChevronDown, Download, X, ExternalLink, Trash2, Globe 등).

## 에러 처리

| 상황 | 처리 |
|---|---|
| 탭 저장 실패(드롭/창전체) | Toast로 실패 알림, 부분 성공 시 "N/M 저장됨". |
| 파비콘 로드 실패 | `<Favicon>`이 onError로 Lucide globe 폴백. |
| chrome API 부재(웹에서 OpenTabs 컴포넌트 오용) | OpenTabsPanel은 확장에서만 렌더(웹은 미포함). |
| 패널 상태 저장소 접근 실패 | 기본값(둘 다 펼침)으로 폴백. |

## 테스트 전략

| 레이어 | 도구 | 대상 |
|---|---|---|
| 단위 | Vitest | `groupTabsByWindow`(창 그룹화), 패널 상태 reducer/훅 로직 |
| 컴포넌트 | Vitest + Testing Library | LinkCard(재스타일·hover 액션), CollectionSection(접기/링크추가 콜백), OpenTabsPanel(목 데이터 그룹 렌더·드래그 핸들), AppShell(접힘 토글), Toast |
| 빌드 | tsc + 각 앱 build | 웹·확장 빌드 통과 |
| 수동 | 사람 | 확장 로드 후 드래그-저장·창전체저장·탭닫기·패널 접기 실제 동작(헤드리스 불가) |

- 기존 통합 테스트(core RLS/데이터)는 변경 없음 — 시각 리디자인은 데이터 계층 미변경.

## 구현 순서 (점진적)

1. `@tablign/ui` 토큰(theme) + 아이콘(icons) + 프리미티브(Button/IconButton/Card/InlineInput).
2. LinkCard 재스타일 + Favicon 폴백 (컴포넌트 테스트).
3. CollectionSection(헤더+그리드+링크추가+접기) + 새 Board(세로 섹션) (테스트). CollectionColumn 제거.
4. AppShell + SidePanel(접기) + Toast + EmptyState.
5. 웹 적용: Sidebar/Toolbar 재구성, usePanelState(localStorage), prompt→InlineInput, 드래그/검색/태그/Realtime 재연결.
6. 확장: groupTabsByWindow(TDD) + OpenTabsPanel(드래그 소스·창전체저장·탭닫기) + NewTab을 AppShell로, usePanelState(chrome.storage).
7. 확장 팝업 소폭 룩 정리 + 전체 빌드/테스트 + 수동 검증 절차.

## UI 방향 요약

"Studio": 흰 배경 + 인디고 강조 + Lucide 라인 아이콘. 좌 사이드바(스페이스·검색·태그),
중앙 그룹형 보드(컬렉션=섹션, 링크=카드 그리드), 우 OPEN TABS(확장). 좌·우 접기 가능,
인라인 입력·토스트·빈상태로 직관적 UX.
