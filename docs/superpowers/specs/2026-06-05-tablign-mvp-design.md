# tablign — 토비(Toby) 클론 개인용 MVP 설계

작성일: 2026-06-05

## 개요

토비(gettoby.com)와 같은 시각적 북마크/탭 관리 서비스의 개인용 MVP. 사용자는
브라우저 탭과 링크를 **컬렉션**으로 묶고, 보드형 대시보드에서 한눈에 보고
정리하며, 한 번에 열 수 있다. 웹 앱과 크롬 확장 프로그램을 함께 제공하고,
디바이스 간 클라우드 동기화를 지원한다.

협업/공유(팀 워크스페이스, 컬렉션 공유, 실시간 협업 편집)는 이번 MVP 범위에서
제외하며, 이후 사이클에서 별도 스펙으로 다룬다.

## 목표 (MVP 범위)

- 인증: 이메일 + Google 로그인
- 스페이스(Space): 최상위 구분 (예: 개인, 사이드프로젝트)
- 컬렉션(Collection): 링크들의 묶음, 보드 위의 세로 리스트
- 링크 카드: 제목·URL·파비콘·썸네일, 클릭 시 열기
- 크롬 확장: 현재 탭 저장 / 열린 탭 전부 저장 / 새 탭 페이지 대체
- 드래그 앤 드롭: 링크·컬렉션 순서 변경 및 컬렉션 간 이동
- 태그: 컬렉션 단위 태그 + 태그 필터
- 검색: 컬렉션·링크 제목/URL
- 노트: 컬렉션 메모
- 컬렉션 한 번에 열기(Open all)
- 클라우드 동기화 (디바이스 간 자동)

## 비목표 (MVP 제외, 다음 사이클)

- 팀 워크스페이스 / 멤버 초대
- 컬렉션 공유 / 공개 링크
- 실시간 협업 편집
- Chrome 외 브라우저(Firefox/Edge) 확장

## 기술 스택

- 프론트엔드: Next.js (App Router)
- 백엔드(BaaS): Supabase — Auth, Postgres, Realtime, Row Level Security
- 배포: Vercel (웹 앱)
- 드래그 앤 드롭: `@dnd-kit`
- 서버 상태/캐시: TanStack Query
- 가벼운 UI 상태: React 상태 / Zustand
- 테스트: Vitest, Testing Library, 로컬 Supabase, Playwright
- 저장소: 모노레포

## 아키텍처

세 개의 클라이언트(웹 앱, 확장 팝업, 새 탭 페이지)가 하나의 Supabase
백엔드를 공유한다.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  웹 앱 (Next.js)  │     │ 크롬 확장 프로그램   │     │  새 탭 페이지         │
│  /dashboard      │     │ (팝업 + 백그라운드) │     │ (chrome new tab 대체)│
└────────┬────────┘     └─────────┬────────┘     └──────────┬──────────┘
         │      모두 동일한 Supabase JS 클라이언트 사용         │
         └────────────────────────┼──────────────────────────┘
                       ┌──────────▼───────────┐
                       │      Supabase         │
                       │  • Auth (이메일/구글)  │
                       │  • Postgres (데이터)   │
                       │  • Realtime (동기화)   │
                       │  • RLS (행 단위 보안)  │
                       └───────────────────────┘
```

### 핵심 설계 원칙

1. **백엔드 로직 최소화.** 비즈니스 규칙은 Postgres RLS 정책으로 강제한다
   (사용자는 자기 데이터만 접근). 별도 API 서버 없이 클라이언트가 Supabase에
   직접 안전하게 접근한다. 예외는 메타데이터 수집용 Next.js Route Handler 하나.
2. **클라이언트 간 코드 공유.** 데이터 접근/타입은 `packages/core`, 공용 React
   컴포넌트는 `packages/ui`로 분리하여 웹 앱과 확장이 공유한다.
3. **새 탭 페이지 = 웹 대시보드 재사용.** 새 탭 페이지는 확장에 번들된 React
   앱이며 웹 대시보드와 거의 같은 컴포넌트(`<Board>` 등)를 재사용한다.
4. **동기화는 Supabase Realtime.** 한 디바이스의 변경이 타 디바이스/새 탭에
   자동 반영된다.

### 저장소 구조 (모노레포)

```
tablign/
├── apps/
│   ├── web/          # Next.js 웹 앱 (대시보드)
│   └── extension/    # 크롬 확장 (팝업 + 새 탭 + 백그라운드)
├── packages/
│   ├── core/         # 데이터 접근, 타입, Supabase 클라이언트 (공용)
│   └── ui/           # 공용 React 컴포넌트 (보드, 카드 등)
└── supabase/         # DB 스키마, 마이그레이션, RLS 정책
```

## 데이터 모델

모든 테이블은 `user_id`를 가지며 RLS로 "본인 행만 접근"을 강제한다.

```
profiles                       (auth.users 확장)
 ├─ id (= auth user id)
 ├─ display_name
 └─ avatar_url

spaces                         (최상위 구분)
 ├─ id
 ├─ user_id
 ├─ name
 ├─ icon        (이모지)
 └─ position    (정렬 순서)

collections                    (보드 위의 컬렉션 = 세로 리스트)
 ├─ id
 ├─ space_id    → spaces.id   (ON DELETE CASCADE)
 ├─ user_id
 ├─ title
 ├─ icon
 ├─ note                       (컬렉션 메모)
 └─ position

links                          (컬렉션 안의 링크 카드)
 ├─ id
 ├─ collection_id → collections.id (ON DELETE CASCADE)
 ├─ user_id
 ├─ url
 ├─ title
 ├─ favicon_url
 ├─ thumbnail_url              (OpenGraph 이미지)
 ├─ custom_title               (사용자가 수정한 제목)
 └─ position

tags                           (태그 마스터)
 ├─ id
 ├─ user_id
 ├─ name
 └─ color

collection_tags                (컬렉션 ↔ 태그, 다대다)
 ├─ collection_id → collections.id (ON DELETE CASCADE)
 └─ tag_id         → tags.id        (ON DELETE CASCADE)
```

### 설계 포인트

1. **`position` 컬럼으로 드래그 순서 관리.** 큰 간격 방식(예: 1000, 2000,
   3000)으로 중간 삽입을 효율화한다(사이 삽입 시 1500). 간격이 좁아지면
   재정규화한다.
2. **종속 삭제.** 컬렉션 삭제 시 링크도 함께 삭제(CASCADE). 스페이스 삭제 시
   컬렉션·링크도 삭제.
3. **태그는 컬렉션 단위.** 링크 개별이 아니라 컬렉션에 태그를 단다.
4. **메타데이터 수집 방식:**
   - 확장에서 저장 시: 브라우저가 아는 탭 제목·파비콘을 그대로 전달.
   - 웹에서 URL만 붙여넣을 때: 서버에서 해당 URL의 OpenGraph 태그를 한 번
     가져와 제목/썸네일을 채운다. → `apps/web`의 `/api/metadata` Route
     Handler 하나가 담당.

### RLS 정책

모든 테이블에 `user_id = auth.uid()` 조건으로 SELECT/INSERT/UPDATE/DELETE를
제한한다. (`collection_tags`는 연결된 컬렉션의 소유자 기준으로 검증.)

## 컴포넌트 구성

### 웹 앱 (`apps/web`)

```
/login                 로그인 (이메일 + 구글)
/dashboard             보드형 메인 (선택된 스페이스의 컬렉션들)
  ├─ <Sidebar>         스페이스 목록 + 태그 필터
  ├─ <Board>           가로 스크롤 컨테이너 (컬렉션 나열)
  │   └─ <CollectionColumn>   컬렉션 1개 = 세로 리스트
  │        ├─ <CollectionHeader>  제목·아이콘·메뉴(이름변경/삭제/Open all)
  │        ├─ <LinkCard> × N       파비콘·제목·썸네일, 클릭=열기
  │        └─ <AddLinkInput>       URL 붙여넣기로 링크 추가
  ├─ <SearchBar>       상단 검색 (컬렉션·링크 제목/URL)
  └─ <CommandMenu>     (선택) Cmd+K 빠른 검색/이동
```

공용(`packages/ui`): `<Board>`, `<CollectionColumn>`, `<LinkCard>` — 새 탭
페이지가 재사용.

### 크롬 확장 (`apps/extension`)

```
manifest.json (MV3)
├─ popup/         툴바 아이콘 클릭 팝업
│    ├─ "현재 탭 저장 → [컬렉션 선택]"
│    ├─ "열린 탭 전부 저장 → 새 컬렉션"
│    └─ 미니 컬렉션 목록
├─ newtab/        새 탭 페이지 (chrome_url_overrides) — 웹의 <Board> 재사용
└─ background/    서비스 워커 (탭 정보 수집, 인증 토큰 보관)
```

### 핵심 상호작용 흐름

1. **현재 탭 저장:** 팝업 → background가 활성 탭의 url/title/favicon 수집 →
   선택한 컬렉션에 `links` INSERT.
2. **모든 탭 저장:** 팝업 → background가 현재 창의 모든 탭 수집 → 새
   `collection` 생성 후 링크 일괄 INSERT.
3. **드래그 앤 드롭:** 드롭 위치 기반으로 `position`(필요 시 `collection_id`)
   갱신 → Realtime으로 타 디바이스 반영.
4. **Open all:** 컬렉션의 모든 링크를 `chrome.tabs.create`(확장) 또는
   `window.open`(웹)으로 일괄 오픈.

## 인증 · 동기화 · 에러 처리

### 인증

- Supabase Auth (이메일/비밀번호 + Google OAuth).
- 웹 앱: `@supabase/ssr` 쿠키 기반 세션. 미들웨어로 `/dashboard` 보호.
- 확장: MV3 서비스 워커가 토큰을 `chrome.storage.local`에 보관. 최초 로그인은
  웹 로그인 페이지를 새 탭으로 열어 처리한 뒤 세션을 확장으로 전달. 확장에서
  비밀번호를 직접 다루지 않는다.

### 동기화

- Supabase Realtime으로 `spaces`/`collections`/`links` 변경 구독.
- 낙관적 업데이트: 드래그·추가·삭제 시 UI 선반영, 서버 실패 시 롤백.
- TanStack Query로 서버 상태 관리. Realtime 이벤트 수신 시 해당 쿼리 무효화.

### 에러 처리

| 상황 | 처리 |
|---|---|
| 네트워크 끊김 | 낙관적 업데이트 실패 시 토스트 + UI 롤백. 읽기는 캐시 유지. |
| 메타데이터 수집 실패 | 제목/썸네일 없이 URL만 저장, 도메인명을 제목으로 폴백. |
| 중복 링크 저장 | 허용 (의도적으로 여러 컬렉션에 둘 수 있음). |
| 인증 만료 | Supabase 토큰 자동 갱신. 실패 시 로그인 페이지로. |
| Open all 팝업 차단 | 확장은 영향 없음. 웹은 "N개 탭이 열립니다" 확인 후 진행. |

상태 관리: 서버 상태는 TanStack Query, 가벼운 UI 상태(선택 스페이스, 검색어)는
React 상태/Zustand. 과한 전역 상태 라이브러리는 쓰지 않는다.

## 테스트 전략

| 레이어 | 도구 | 대상 |
|---|---|---|
| 단위 | Vitest | `packages/core` 데이터 접근, `position` 재정렬, 메타데이터 파싱 |
| 컴포넌트 | Vitest + Testing Library | `<LinkCard>`, `<CollectionColumn>` 렌더·상호작용 |
| 통합(DB) | 로컬 Supabase + Vitest | RLS 정책 검증, CRUD |
| E2E | Playwright | 로그인 → 컬렉션 생성 → 링크 추가 → Open all 플로우 |

- RLS 정책 테스트를 반드시 포함한다(다른 사용자 데이터 접근 차단을 자동 검증).
- 핵심 로직(재정렬, 데이터 접근, 메타데이터)은 TDD로 진행.
- 확장의 브라우저 API(`chrome.tabs` 등)는 모킹하여 background 로직을 단위
  테스트.

## 구현 순서 (점진적, 각 단계가 동작하는 결과물)

1. 모노레포 + Supabase 프로젝트 + DB 스키마 + RLS (기반)
2. 웹 인증 (로그인/로그아웃)
3. 스페이스·컬렉션·링크 CRUD + 보드 UI (수동 추가로 동작)
4. 메타데이터 라우트 (제목/파비콘/썸네일)
5. 드래그 앤 드롭 + position 재정렬
6. 태그 + 검색
7. Realtime 동기화 + 낙관적 업데이트
8. 크롬 확장: 팝업(현재 탭/모든 탭 저장)
9. 크롬 확장: 새 탭 페이지(보드 재사용)
10. Open all + 마무리 polish

각 번호는 끝나면 실제로 써볼 수 있는 단위다. 1~3만 끝나도 수동으로 링크를 모으는
웹 앱이 동작한다.

## UI 방향

대시보드는 **보드형(A안)**: 좌측 사이드바(스페이스 + 태그), 우측에 컬렉션들이
가로로 나란히 펼쳐지는 세로 리스트. 모든 링크가 한눈에 보이며 드래그로 옮기기
쉽다. 토비의 새 탭 페이지 경험에 가장 충실하다.

## 알려진 갭 / 후속 하드닝 (코드 리뷰에서 도출)

Plan 2 구현 후 코드 리뷰에서 확인된, 의도적으로 미룬 항목:

- **드래그앤드롭 재정렬은 현재 "맨 뒤로 이동"만 지원.** 컬럼 내 임의 위치 삽입/같은 컬럼 재정렬은 미구현(Plan 2 Task 10에서 범위 한정). `positionBetween`은 중간 삽입을 지원하므로, 향후 plan에서 드롭 인덱스 기반 재정렬로 확장.
- **`/api/metadata` SSRF 하드닝 일부만 적용.** http(s) 스킴만 허용 + `redirect: "manual"`까지 적용함. 사설/루프백/링크로컬 호스트(예: 169.254.169.254, RFC1918) 차단은 미적용 — 인증 게이트 뒤의 MVP 위험으로 수용하되, 공개 배포 전 호스트 차단을 추가할 것.

### Plan 3 후속 (코드 리뷰 도출)

- **Realtime RLS 누수 확인 필요.** `postgres_changes` 구독은 클라이언트 JWT + 테이블 RLS로 타 사용자 행이 전달되지 않아야 한다(`@supabase/ssr` 브라우저 클라이언트가 토큰을 전달하므로 통상 안전). 다만 무효화 콜백은 페이로드 비의존(테이블 키만 무효화 → 재조회는 RLS 보호)이라, 설령 이벤트가 새더라도 "어떤 행이 바뀌었다"는 사실 외 데이터 노출은 없음. 공개 배포 전 2-사용자 음성 테스트로 확정할 것.
- **`collection_tags` REPLICA IDENTITY FULL 미적용.** DELETE/UPDATE 시 PK 외 컬럼이 페이로드에 안 옴. 현재는 페이로드 비의존 무효화라 동작에 문제 없음. payload.old를 쓰게 되면 `alter table public.collection_tags replica identity full;` 추가.
- **검색 디바운스 적용함**(useDeferredValue). 태그 생성은 대소문자 구분 정확 일치 — 추후 대소문자 무시/유니크 제약 고려.
