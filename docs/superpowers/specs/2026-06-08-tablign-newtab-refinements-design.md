# tablign — 새 탭 다듬기 (그리드·드롭 미리보기·편집) 설계

작성일: 2026-06-08

## 개요

확장 새 탭의 사용성 피드백을 반영한다: (1) 드롭 위치가 의도와 다르게 저장되는 버그
수정, (2) 드래그 시 들어갈 자리를 **고스트 카드 미리보기**로 표시, (3) "+ 컬렉션"
클릭 시 즉시 생성 후 이름 입력 자동 포커스, (4) 컬렉션 이름 수정, (5) 저장된 링크를
**반응형 그리드**로 표시, (6) 각 링크 카드의 **제목·URL·메모** 편집.

기존 Studio 룩(`@tablign/ui`)과 데이터 계층(`@tablign/core`)을 확장하며, 공용
컴포넌트 개선(LinkCard 편집, CollectionSection 이름 수정)은 웹에도 자동 반영된다.

## 목표

- 드롭 위치를 **커서 좌표 기준**으로 판정해 정확한 위치에 저장.
- 드래그 중 **고스트 미리보기 카드**가 그리드 삽입 지점에 끼어 카드들이 밀림.
- 링크 카드 = **반응형 CSS 그리드**.
- "+ 컬렉션" → 즉시 생성("새 컬렉션") + 제목 인라인 입력 자동 포커스.
- 컬렉션 이름 인라인 수정.
- 링크 카드 제목·URL·메모 인라인 편집.

## 비목표

- 웹 대시보드의 링크 드래그 복원(별도 과제), 다크 모드, 확장 스페이스 전환.
- 카드 썸네일(og:image) 표시(후속).

## 근본 원인 (드롭 위치 버그)

현재 `handleDragMove`는 삽입 위치(before/after)를 **드래그 중인 요소의 박스 중심**
(`active.rect.current.translated`)과 대상 카드 중심을 비교해 판정한다. DragOverlay
사용 시 원본 요소의 박스 중심은 커서와 (잡은 지점·요소 크기만큼) 어긋나므로 판정이
빗나가 엉뚱한 위치에 저장된다. → **커서 좌표**(`activatorEvent.clientX/Y + delta`)로
판정해야 직관적("커서가 있는 자리")으로 정확히 들어간다.

## 데이터 모델 변경

`links`에 `note text`(nullable) 추가:
- 마이그레이션 `supabase/migrations/0004_links_note.sql`: `alter table public.links add column note text;`
- `@tablign/core` `Link`에 `note: string | null`; `CreateLinkInput`에 `note?: string | null`;
  `updateLink` patch 허용 필드에 `url`·`note` 추가(기존 title/custom_title/favicon/thumbnail/position 유지).
- RLS/정책 변경 없음(컬럼만 추가, nullable이라 기존 INSERT·테스트 영향 없음).

## 컴포넌트 / 동작

### `@tablign/ui`
- **CollectionSection**: 제목을 클릭하면 인라인 입력으로 수정(`InlineInput`) → `onRenameCollection(id, title)` 콜백. `autoEditTitle?: boolean` prop이 true면 마운트 시 제목 편집 모드로 시작(생성 직후 자동 포커스용). `onRenameCollection`은 선택적(없으면 제목 클릭 편집 비활성).
- **LinkCard**: hover 시 편집(연필, `Pencil` 아이콘) 노출 → 클릭 시 인라인 편집 폼(제목/URL/메모 입력 + 저장/취소) → `onUpdate?(id, { custom_title, url, note })`. `onUpdate` 미제공 시 편집 연필 숨김. 메모가 있으면 카드 하단에 부제로 표시.
- 아이콘 추가: `icons.ts`에 `Pencil` 재export.

### 확장 (`apps/extension`)
- **DndLinkList(재작성)**: 링크를 반응형 그리드로 렌더. 드래그 중 `dropIndicator`에 맞춰
  **고스트 미리보기 카드**를 삽입 인덱스에 끼워 넣어 그리드가 reflow. 각 카드는
  draggable(순서변경) + droppable(before/after 판정용 데이터: collectionId, linkId, nextLinkId).
  맨 끝 드롭용 EndZone droppable 유지.
- **NewTab**: `handleDragMove`를 **커서 좌표 기준**으로 변경(`activatorEvent`+`delta`로 cursorX/Y 산출, 그리드이므로 대상 카드 중심 X와 비교해 before/after). `active`(드래그 중 항목)를 DndLinkList에 전달해 고스트 미리보기 렌더. "+ 컬렉션"은 즉시 `createCollection("새 컬렉션")` 후 해당 섹션을 `autoEditTitle`로 표시. 컬렉션 이름 수정·링크 편집을 `updateCollection`/`updateLink`로 배선하고 해당 컬렉션만 재조회.

### 웹 (`apps/web`)
- `useUpdateLink` 훅 추가(낙관/무효화) 및 `DashboardClient`에서 LinkCard `onUpdate`, CollectionSection `onRenameCollection` 연결(공용 개선 자동 수혜). DnD는 변경 없음.

## 상호작용 세부

- **삽입 위치 판정(그리드):** 커서가 대상 카드의 좌측 절반이면 그 카드 앞, 우측 절반이면 다음 카드 앞(없으면 끝). EndZone 위이면 끝. `dropIndicator = { collectionId, beforeLinkId }`.
- **미리보기:** DndLinkList가 `beforeLinkId` 위치에 고스트 카드(드래그 항목의 파비콘+제목)를 삽입; 원본(순서변경 시)은 흐리게.
- **영속화:** `positionForInsert(targetLinks, beforeLinkId, movingId?)`(테스트 완료)로 position 계산 → 탭은 `createLink({...input, position})`, 링크는 `moveLink(id, collectionId, position)`.
- **편집 충돌 방지:** 카드 클릭=열기, 연필=편집, 드래그=이동(PointerSensor distance 5). 편집 입력/버튼은 `pointerDown` 전파 중단으로 드래그 미발동.

## 에러 처리

| 상황 | 처리 |
|---|---|
| URL 편집이 빈 값/형식 오류 | 저장 막고 입력 유지(빈 값이면 저장 안 함). |
| updateLink/updateCollection 실패 | 콘솔 에러 + 해당 영역 재조회로 원상 복구. |
| 드롭 대상 없음(over null) | 미리보기/저장 없음(no-op). |

## 테스트 전략

| 레이어 | 도구 | 대상 |
|---|---|---|
| 단위 | Vitest | `positionForInsert`(완료), `updateLink`의 url/note 반영(통합 테스트 1) |
| 컴포넌트 | Vitest+RTL | LinkCard 편집 모드(제목/URL/메모 저장 콜백), CollectionSection 이름 편집(onRename·autoEdit) |
| 통합(DB) | 로컬 Supabase | note 컬럼 read/write, updateLink url·note |
| 빌드 | tsc + build | ui·web·extension 통과 |
| 수동 | 사람(크롬) | 그리드 미리보기 드롭 위치, 순서변경, 컬렉션 생성→자동포커스, 이름수정, 카드 편집 |

## 구현 순서

1. DB 마이그레이션 0004(links.note) + core 타입/`updateLink`(url·note) + 통합 테스트.
2. `@tablign/ui` LinkCard 편집 모드(+Pencil) (컴포넌트 테스트).
3. `@tablign/ui` CollectionSection 제목 인라인 편집 + autoEditTitle (컴포넌트 테스트).
4. 확장 DndLinkList 그리드 + 고스트 미리보기.
5. 확장 NewTab 커서판정·"+컬렉션 즉시생성+자동포커스"·이름수정·카드편집 배선.
6. 웹 useUpdateLink + DashboardClient 편집·이름수정 연결.
7. 전체 빌드/테스트 + 수동 검증.

## UI 방향 요약

저장된 링크는 토비처럼 반응형 카드 그리드. 드래그하면 고스트 카드가 들어갈 자리에
끼어 카드들이 밀리며 위치를 미리 보여주고, 커서 위치 그대로 저장. 컬렉션은 생성 즉시
이름을 바로 입력, 제목·카드(제목/URL/메모)는 인라인으로 수정.
