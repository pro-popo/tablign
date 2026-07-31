# 북마크 가져오기(마이그레이션) 설계

- 작성일: 2026-07-31
- 상태: 설계 승인 대기
- 선행: [조직 설계](2026-07-16-organizations-design.md) (조직·스페이스 구도 위에 얹음)
- 시안: `docs/design/bookmark-import-mapping.html` (매핑 규칙 + UI 3안, B안 채택), `docs/design/bookmark-import-b-variants.html` (B안 시각 디자인 3안, 기각 — 원안 유지)

## 1. 목표와 범위

다른 도구에 쌓아둔 북마크를 tablign으로 옮긴다. 신규 사용자가 빈 보드를 직접 채우는 대신 **이미 가진 것을 그대로 들고 들어오게** 만드는 것이 목적이다.

### 범위

- **이번 작업: Chrome 북마크.** `chrome.bookmarks` 트리를 읽어 스페이스·컬렉션·링크로 옮긴다.
- **이번 작업(추가): Toby.** Toby가 내보낸 JSON 파일(version 4, 실제 export로 스키마 검증 완료)을 같은 미리보기·같은 RPC로 처리한다. `group → 스페이스, list → 컬렉션, card → 링크`로 계층이 정확히 떨어지고, `favIconUrl`이 있어 파비콘 유추가 필요 없다(소스 파비콘이 유추보다 우선). `customTitle`이 비어 있지 않으면 제목으로 쓴다.

### 설계의 중심 문제

기술적 난점은 없다. 어려운 건 **사용자의 불안**이다 — "북마크 584개를 넣으면 내 새 탭이 어떻게 망가지는지 모르겠다." 이 설계의 거의 모든 결정이 이 한 줄에서 나온다.

- 매핑 규칙은 **예측 가능**해야 한다(§2). 규칙이 상황에 따라 달라지면 결과를 상상할 수 없다.
- UI는 **결과를 미리 보여줘야** 한다(§3). 설정값이 아니라 결과가 화면에 있어야 한다.
- 버리는 것은 http/https가 아닌 링크뿐이다(트리 개수에 애초에 세지 않는다). **중복 URL은 버리지 않는다** — 아래 규칙 6.
- 원본은 **건드리지 않는다.** Chrome 북마크는 그대로 남는다. 복사만 한다.

### 제약

- 익스텐션 단독 앱이다. 파일 선택·북마크 읽기·삽입이 전부 새 탭 안에서 일어난다.
- tablign 계층은 `조직 → 스페이스 → 컬렉션 → 링크` 4단, Chrome 북마크는 폴더가 임의 깊이로 중첩된다. **깊이를 접는 규칙**이 설계의 핵심이다.

## 2. 매핑 규칙 — `planImport`

### 순수 함수로 뽑는 이유

미리보기와 실제 삽입이 **같은 함수**를 써야 한다. 어긋나면 화면이 거짓말을 한다. 그래서 계획 수립을 부수효과 없는 순수 함수로 분리하고, UI는 그 결과만 그리고 RPC는 그 결과만 받는다.

```ts
// packages/core/src/import/plan.ts

/** Chrome·Toby 공통 입력 형태로 정규화한 트리 */
export interface SourceNode {
  id: string;
  title: string;
  url?: string;                 // 있으면 링크, 없으면 폴더
  children?: SourceNode[];
}

export interface ImportConfig {
  /** 폴더 id → 가져올지. 기본값은 defaultEnabled()가 계산한다. */
  enabled: Record<string, boolean>;
}

export interface PlannedLink {
  url: string;
  title: string | null;
  favicon_url: string | null;
}

export interface PlannedCollection {
  sourceId: string;             // 출처 폴더 id (스페이스 직속 링크면 스페이스 폴더 id)
  title: string;
  /** 원본에 없던, 가져오기가 만들어낸 컬렉션(공유 폴더 / 이름 합침) */
  synthetic: boolean;
  links: PlannedLink[];
}

export interface PlannedSpace {
  sourceId: string;
  name: string;
  collections: PlannedCollection[];
}

export interface ImportPlan {
  spaces: PlannedSpace[];
  totals: { spaces: number; collections: number; links: number };
}

export function planImport(roots: SourceNode[], config: ImportConfig): ImportPlan;
export function defaultEnabled(roots: SourceNode[]): Record<string, boolean>;
```

### 규칙 (적용 순서대로)

1. **루트는 스페이스가 아니다.** `북마크바`·`기타 북마크`·`모바일 북마크`는 Chrome의 컨테이너일 뿐이다. 단, 루트에 **직속 링크**가 있으면 그 링크만 담을 루트 이름의 스페이스 하나를 만든다.
2. **1단 폴더 = 스페이스.** 루트의 자식 폴더는 하위 폴더가 있든 없든 각각 스페이스가 된다.
3. **자손 폴더 = 컬렉션.** 컬렉션 이름은 스페이스 폴더 기준 **상대 경로 전체를 `/`로 이은 것**이다. 깊이 2는 폴더 이름 그대로(`React`), 깊이 3은 `React/Hooks`, 깊이 4는 `React/Hooks/고급`. 폴더가 사라지지도, 컬렉션이 폭발하지도 않는다. 상대 경로 전체를 쓰기 때문에 한 스페이스 안에서 이름이 충돌할 수 없다 — 경로는 유일하다.
4. **폴더 직속 링크 → `공유 폴더`.** 하위 폴더와 링크가 섞인 폴더에서, 폴더에 직접 들어있던 링크만 모아 `공유 폴더`라는 컬렉션으로 만든다. 스페이스 폴더 자신의 직속 링크도 같다. 직속 링크가 0개면 만들지 않는다.
5. **빈 것은 만들지 않는다.** 링크 0개인 컬렉션, 컬렉션 0개인 스페이스는 계획에 넣지 않는다. 링크와 자손 폴더가 모두 0인 폴더는 UI 트리에도 보이지 않는다.
6. **중복 URL은 제거하지 않는다 — 소스에 있는 그대로 담는다.** 처음엔 가져오기 전체에서 URL당 하나만 남기는 규칙이었으나, 실제 Toby 데이터 검증에서 프로젝트 스페이스 7곳에 같은 모노레포 링크를 일부러 넣어둔 패턴이 확인돼 **의도적 중복을 지우는 부작용이 더 크다**고 판단, 제거를 삭제했다(2026-07-31 결정). URL 정규화도 중복 판정 전용이었으므로 함께 삭제.
7. **파비콘**은 `new URL(url).origin + '/favicon.ico'`로 만든다. Chrome 북마크 API는 아이콘을 주지 않는다. 대부분의 사이트가 이 자리에 아이콘을 두고, 없는 사이트는 `Favicon` 컴포넌트의 `onError`가 이미 지구본으로 떨어뜨린다. 제3자 서비스를 거치지 않고 다른 브라우저·웹에서도 그대로 동작한다. 파싱 실패 시 `null`.
8. **제목**은 북마크 title을 쓰고, 빈 문자열이면 `null`(`LinkCard`가 도메인으로 대체한다).
9. **position**은 계획 순서대로 `(i + 1) * GAP` — 기존 `sequentialPositions` 규칙.

### 기본 선택값 `defaultEnabled`

가져오기 다이얼로그가 열린 순간의 체크 상태다. 사용자는 **고치는 것만** 하고 백지에서 지정하지 않는다.

- **1단 폴더의 자손 포함 총 링크 수가 100을 넘으면 기본 해제.** 대개 "나중에 읽기" 같은 묘지라서, 켜면 첫 보드가 못 쓰게 된다.
- **`기타 북마크`·`모바일 북마크` 루트 아래는 전부 기본 해제.** 북마크바는 매일 보는 것이고 나머지는 사실상 창고다.
- 그 밖에는 모두 켜짐.

### 상한

계획된 링크 총합이 **2000개를 넘으면** 가져오기 버튼을 막고 이유를 표시한다. 폴더를 꺼서 줄이도록 유도한다. 단일 트랜잭션 삽입과 트리 렌더가 둘 다 이 선에서 안전하다.

## 3. UI

### 다이얼로그 — 2단 미리보기 (시안 B안)

```
┌─ 북마크 가져오기 ──────────────────────────────────────────┐
│ 폴더 14개 · 북마크 584개를 찾았어요.                        │
│ 가져올 조직  [개인 ▾]                                      │
├──────────────────────┬─────────────────────────────────────┤
│ 내 북마크   폴더 12개 │ 이렇게 만들어져요  스페이스 5·컬렉션 10│
│                      │                                     │
│ 북마크바             │ ┌ 개발            컬렉션 4 ┐         │
│ ☑ 📁 개발  3 [스페이스]│ │ React                  8 │         │
│   ☑ 📁 React      8  │ │ React/Hooks            5 │         │
│     ☑ 📁 Hooks    5  │ │ Node                   6 │         │
│   ☑ 📁 Node       6  │ │ 공유 폴더               3 │         │
│ ☑ 📁 디자인 [스페이스] │ └──────────────────────────┘         │
│   ☑ 📁 레퍼런스  24  │ ┌ 디자인          컬렉션 2 ┐         │
│   …                  │ …                                   │
├──────────────────────┴─────────────────────────────────────┤
│ 링크 82개를 스페이스 5개로 가져와요        [취소] [가져오기] │
└────────────────────────────────────────────────────────────┘
```

왼쪽에서 켜고 끄면 오른쪽이 즉시 바뀐다. 오른쪽은 `planImport` 결과를 그대로 그린 것이므로, 사용자는 "가져오기"를 누르기 전에 이미 결과를 본 상태다.

- 1단 폴더 행에 **스페이스** 배지가 붙는다. 자손 폴더 행에는 붙지 않는다(컬렉션이 됨).
- 깊이 3 이상 폴더 행에는 합쳐질 이름을 힌트로 오른쪽에 흐리게 적는다(`React/Hooks`).
- 스페이스 행을 끄면 그 안 컬렉션도 함께 꺼진다.
- 링크 100개 초과 폴더가 있으면 트리 아래에 왜 기본 해제했는지 한 줄로 설명한다.
- 모든 개수는 고정폭 + `tabular-nums`로 열을 맞춘다.

### 조직 선택

다이얼로그 상단에 목적지 조직을 표시한다. **기본값은 지금 보고 있는 조직.**

**조직을 새로 만드는 경로는 두지 않는다.** 조직은 항상 최소 하나 존재하고 지울 수 없기 때문에 — `handle_new_user` 트리거가 가입 시 `개인` 조직을 만들고, `organizations_personal_uniq`가 유저당 하나를 강제하며, delete 정책이 `not is_personal`로 개인 조직 삭제를 막는다 — 목적지가 없어서 막히는 경우가 존재하지 않는다. 조직을 새로 만들고 싶으면 사이드바 레일의 `조직 만들기`를 쓰면 된다.

가진 조직이 **하나뿐이면 드롭다운이 아니라 읽기 전용 한 줄**로 목적지만 보여준다. 선택지가 하나인 드롭다운은 고를 수 있다는 거짓 신호를 준다. 목적지 자체는 항상 화면에 있어야 한다 — 어디로 들어가는지 모르는 것이 이 기능에서 가장 피해야 할 상태다.

### 진입점 두 곳

두 곳 모두 **북마크·Toby를 하나의 "가져오기"로 묶는다.** 메뉴에 항목을 둘로 늘리지 않는다.

`가져오기`를 누르면 **소스 선택 화면**(`ImportSourceDialog`)이 먼저 열린다 — Chrome 북마크 / Toby(JSON 파일 선택). 어느 쪽을 고르든 같은 미리보기 다이얼로그로 이어지며, 제목만 소스에 따라 바뀐다("북마크 가져오기" / "Toby 가져오기"). 미리보기 다이얼로그는 소스를 모른다 — `SourceNode[]`만 받는다.

1. **조직 헤더 더보기 메뉴** (`OrgHeader`) — 상시 진입점. 항목 하나: `가져오기`.
2. **온보딩 빈 상태** (`SpaceOnboarding`) — 스페이스가 하나도 없을 때, `첫 스페이스 만들기` 버튼 **아래**에 보조 행동으로 노출. 전환이 가장 필요한 순간이다.

**공유 코드 가져오기는 그대로 둔다.** 현재 `AddCollectionButton`·`CollectionOnboarding`에서 열리며, 컬렉션 단위 동작이라 자리가 맞다. 이번 작업에서 옮기지 않는다.

### 가져오기 실행 중·직후

- 버튼이 `가져오는 중…`으로 바뀌고 비활성화된다. 다이얼로그는 닫지 않는다.
- 성공하면 다이얼로그를 닫고 **만들어진 첫 스페이스로 이동**한 뒤 토스트: `스페이스 5개를 만들었어요`.
- 실패하면 다이얼로그를 유지하고 오류를 표시한다. RPC가 단일 트랜잭션이라 반쪽짜리 보드는 남지 않는다.
- **되돌리기는 넣지 않는다.** 스페이스 삭제로 처리한다(§9).

## 4. 권한

`chrome.bookmarks`를 쓰려면 `bookmarks` 권한이 필요하다. **필수 권한으로 넣는다.**

```json
// apps/extension/manifest.json
"permissions": ["tabs", "storage", "identity", "bookmarks"]
```

선택 권한(`optional_permissions` + `chrome.permissions.request()`)을 검토했으나 기각했다.

- **가져오기는 부가 기능이 아니라 주 경로다.** `SpaceOnboarding`(첫 실행 화면)에 진입점을 두기로 했다(§3). 신규 사용자의 주 전환 경로 앞에 권한 확인창을 하나 더 세우는 것은 가장 아까운 자리에 마찰을 만드는 일이다. 선택 권한은 어쩌다 쓰는 기능에 쓰는 장치다.
- **설치 화면의 한계 비용이 작다.** 이미 `tabs` 때문에 "브라우징 기록 읽기"가 표시된다. 체감상 북마크보다 무거운 항목이다. 그 줄을 보고 설치한 사람에게 "북마크 읽기 및 변경" 한 줄이 더해지는 비용은 첫 권한의 비용과 다르다.
- **놀랄 일이 아니다.** manifest의 설명이 "시각적 북마크·탭 관리"다. 북마크 관리 도구가 북마크 권한을 요구하는 것은 사용자 기대와 어긋나지 않는다.
- **`chrome.permissions.request()`는 사용자 제스처 안에서만 동작한다.** 클릭 핸들러가 `await`를 거친 뒤 호출하면 조용히 실패하고, 개발 중에는 이미 권한이 보유된 상태라 드러나지 않는다. 버그를 부르는 제약을 주 경로에 심을 이유가 없다.

Chrome에는 읽기 전용 북마크 권한이 없어서, 부여되는 능력은 "읽기 및 변경"이다. **우리는 읽기만 한다** — Chrome 북마크를 생성·수정·삭제하는 코드는 어디에도 없다(§1의 "원본은 건드리지 않는다"). 나중에 manifest를 보는 사람이 오해하지 않도록 이 사실을 코드 주석으로도 남긴다.

## 5. 데이터 쓰기 — `import_bookmarks` RPC

스페이스·컬렉션·링크를 **한 트랜잭션**에 넣는다. 클라이언트에서 반복 insert하면 중간 실패 시 반쪽짜리 보드가 남고, 링크 2000개면 왕복도 과하다. 기존 `copy_collection`·`import_collection_by_code`와 같은 자리·같은 방식이다.

```sql
-- supabase/migrations/00XX_import_bookmarks.sql
create function public.import_bookmarks(p_org_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
-- p_payload = ImportPlan.spaces 배열
-- [{ "name": "개발", "collections": [
--     { "title": "React", "links": [{ "url": …, "title": …, "favicon_url": … }] }, … ] }, … ]
--
-- 1) auth.uid() 확인
-- 2) p_org_id에 대한 쓰기 권한 확인 (조직 멤버 또는 오너)
-- 3) 스페이스 → 컬렉션 → 링크를 순서대로 삽입, position은 배열 순서 * 1000
--    스페이스 position은 해당 조직 기존 최대값 뒤에 이어 붙인다
-- 4) { "space_ids": [...], "first_space_id": …, "links": N } 반환
$$;

revoke execute on function public.import_bookmarks(uuid, jsonb) from public, anon;
grant execute on function public.import_bookmarks(uuid, jsonb) to authenticated;
```

- 권한 검증은 조직 설계의 기존 헬퍼를 쓴다. 남의 조직에 밀어 넣을 수 없어야 한다.
- `collections.is_private`는 기본값 `false`.
- 태그는 다루지 않는다(`copy_collection`과 같은 결정).
- 페이로드 크기: 링크 2000개 × 3필드면 수백 KB 수준으로, 단일 RPC 인자로 문제없다.

## 6. 구조와 파일 배치

| 위치 | 책임 |
|---|---|
| `packages/core/src/import/plan.ts` | `planImport`·`defaultEnabled`. 순수 함수, 브라우저 API 의존 없음 |
| `packages/core/src/import/chrome.ts` | `chrome.bookmarks` 트리 → `SourceNode[]` 정규화 |
| `packages/core/src/data/import.ts` | `import_bookmarks` RPC 호출 래퍼 |
| `packages/ui/src/ImportBookmarksDialog.tsx` | 2단 미리보기 다이얼로그. `ImportPlan`을 받아 그리기만 한다 |
| `apps/extension/src/newtab/NewTab.tsx` | 다이얼로그 상태·권한 요청·RPC 호출 배선 |

`plan.ts`가 브라우저 API를 모르는 것이 중요하다. 그래서 테스트가 순수 함수 테스트로 끝나고, Toby도 `SourceNode[]`로만 정규화하면 같은 계획 로직을 그대로 탄다.

## 7. 구현 단계

1. **계획 로직** — `planImport`·`defaultEnabled` + 단위 테스트. UI 없이 규칙을 먼저 못 박는다.
2. **RPC + 마이그레이션** — `import_bookmarks`, 권한 검증, RLS 테스트.
3. **다이얼로그** — `ImportBookmarksDialog`. `ImportPlan`을 props로 받으므로 고정 픽스처로 렌더 테스트가 된다.
4. **배선** — manifest에 `bookmarks` 추가, Chrome 트리 읽기, 조직 선택, RPC 호출, 토스트·이동.
5. **진입점** — `OrgHeader` 더보기 메뉴, `SpaceOnboarding` 보조 행동.
6. **Toby** — 실제 export 파일(version 4)로 스키마 확인 후 같은 PR에 포함. `fromTobyExport` 파서(`packages/core/src/import/toby.ts`) + `ImportSourceDialog`(소스 선택) + 배선. "새 조직으로 통째로" 경로는 만들지 않았다 — 조직 선택으로 충분하다.

1~3은 UI·DB가 서로를 안 기다리므로 병렬로 갈 수 있다.

## 8. 테스트

**`planImport` 단위 테스트** — 규칙 하나당 케이스 하나. 이 설계에서 실제로 깨질 수 있는 곳은 거의 전부 여기다.

- 1단 폴더가 스페이스가 되고, 자손 폴더가 컬렉션이 된다
- 깊이 3 이상이 `부모/자식`으로 합쳐진다
- 폴더 직속 링크가 `공유 폴더`로 빠지고, 직속 링크 0개면 만들어지지 않는다
- 루트 직속 링크가 루트 이름의 스페이스로 들어간다
- 링크 0개 컬렉션·컬렉션 0개 스페이스가 계획에서 빠진다
- 같은 URL이 여러 폴더에 있어도 각각 그대로 담긴다
- `defaultEnabled`가 100개 초과 폴더와 `기타 북마크` 아래를 끈다
- `totals`가 스페이스·컬렉션·링크 모두 실제 계획과 일치한다 ← **미리보기가 거짓말하지 않는다는 보증**

**RPC 테스트** — 남의 조직에 삽입 시도가 거부된다, 삽입 실패 시 전부 롤백된다, position이 기존 스페이스 뒤에 이어 붙는다.

**다이얼로그 테스트** — 폴더를 끄면 미리보기와 푸터 숫자가 함께 줄어든다, 스페이스를 끄면 자손도 꺼진다, 2000개 초과면 가져오기가 막힌다, 조직이 하나뿐이면 드롭다운 대신 읽기 전용 한 줄로 나온다.

## 9. 이번에 제외한 것

- ~~Toby~~ — 실제 export 파일 확보로 같은 PR에 포함됨(§7).
- **북마크 HTML 파일 임포트** (Safari·Firefox·Edge·Raindrop). 같은 `SourceNode[]`로 정규화되므로 나중에 파서만 추가하면 된다.
- **되돌리기.** 스페이스 5개가 한 번에 생기는데 마음에 안 들면 하나씩 지워야 한다. "이번 가져오기 취소"는 삽입한 id를 어딘가 기억해야 해서 범위를 넘는다.
- **중복 정리 도구.** 중복 URL을 제거하지 않으므로(§2 규칙 6) 가져오기를 반복하면 같은 링크가 쌓일 수 있다 — 필요해지면 별도 정리 기능으로 다룬다.
- **썸네일**(`thumbnail_url`). 링크 수백 개의 og:image를 긁는 것은 느리고 실패가 많다. 지금도 열린 탭 저장 경로에서 항상 `null`이다.
- **양방향 동기화.** Chrome 북마크가 바뀌면 tablign도 바뀌는 것. 가져오기는 일회성 복사다.
- **`공유 폴더` 이름 재검토.** tablign엔 이미 공유 코드·공유 스페이스·조직 공유가 있어 "공유된 컬렉션"으로 읽힐 소지가 있다(컬렉션에 `is_private`와 공유 메뉴가 붙는 자리라 더 그렇다). 사용자가 이 이름으로 결정했으므로 그대로 간다. 사용 후 혼동이 관측되면 `모아둔 링크`·`기타`가 후보다.
