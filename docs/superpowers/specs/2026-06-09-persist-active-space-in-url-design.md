# 활성 스페이스 URL 영속화 설계

날짜: 2026-06-09

## 문제

대시보드에서 특정 스페이스로 이동한 뒤 새로고침하면 항상 첫 번째 스페이스로 돌아간다.
활성 스페이스가 `DashboardClient.tsx`의 React `useState`로만 관리되고, 새로고침 시
state가 초기화되면서 `useEffect`가 무조건 `spaces[0]`을 선택하기 때문이다.

## 목표

- 특정 스페이스로 이동 후 새로고침해도 같은 스페이스에 머문다.
- 그 스페이스를 가리키는 URL을 복사해 공유하면 동일 스페이스로 진입한다.
  (향후 "에이전트에게 링크 공유" 시 사용)

비목표(이번 범위 제외):
- 외부 비로그인 사용자를 위한 공개 공유(공개 페이지/공유 토큰/RLS) — 나중 단계.
- 컬렉션 단위 URL — 같은 패턴으로 확장 가능하게 두되 이번엔 구현하지 않음.

## 접근

활성 스페이스를 **URL 쿼리 파라미터 `?space=<id>`를 단일 출처(source of truth)**로 삼는다.
React state로 따로 들고 동기화하지 않는다(동기화 버그 회피).

### 변경 지점: `apps/web/src/app/dashboard/DashboardClient.tsx`

1. `activeSpaceId` `useState`(55줄)와 첫 스페이스로 되돌리는 `useEffect`(61–63줄)를 제거한다.
2. `useSearchParams()`로 `space` 파라미터를 읽어 활성 스페이스를 파생한다:
   - 파라미터가 있고 `spaces`에 존재하는 id면 → 그 스페이스.
   - 없거나(첫 진입 `/dashboard`) 더는 존재하지 않는 id면 → `spaces[0]`로 폴백.
   - `spaces`가 비어 있으면 → `null`(기존과 동일하게 빈 상태 처리).
3. `onSelectSpace(id)`는 `router.replace(\`/dashboard?space=${id}\`)`로 URL을 갱신한다.
   - `replace` 사용: 스페이스 전환이 뒤로가기 히스토리를 채우지 않는다.

### 부수 처리: `apps/web/src/app/dashboard/page.tsx`

- `useSearchParams`는 App Router에서 정적 렌더링 시 `<Suspense>` 경계를 요구한다.
  대시보드는 인증(쿠키) 기반 동적 페이지지만, 빌드 경고 방지를 위해 `<DashboardClient>`를
  `<Suspense>`로 감싼다.

### 영향 없는 부분

- 스페이스 생성/삭제, 태그 필터(`activeTagId`), 컬렉션/링크 로직은 그대로 둔다.
- 스페이스 삭제 시: 활성 스페이스가 파생값이라, 삭제된 id면 자동으로 첫 스페이스로 폴백된다.

## 검증 (수동 + 실제 실행)

1. 스페이스 B로 전환 → URL이 `?space=<B>`로 바뀐다.
2. 새로고침 → 여전히 스페이스 B가 활성.
3. `?space=<B>` URL 직접 방문 → 스페이스 B 진입.
4. 파라미터 없이 `/dashboard` 방문 → 첫 스페이스.
5. 존재하지 않는 `?space=zzz` → 첫 스페이스로 폴백(에러 없음).
