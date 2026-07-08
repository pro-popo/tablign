# 공유 기능 설계 (스페이스 협업 · 컬렉션 공유)

- 작성일: 2026-07-03
- 상태: 설계 승인 대기

## 1. 목표와 범위

tablign을 개인용 도구에서 협업 도구로 확장한다. 기능은 세 덩어리다.

1. **내 스페이스 간 컬렉션 복사/이동** — 공유 인프라 없이 동작하는 기본 편의 기능
2. **컬렉션 공유 코드** — 코드 발급 → 받는 사람이 자기 스페이스로 스냅샷 복사
3. **공유 스페이스 협업** — 이메일 초대, 오너/편집자/뷰어 3단계 권한, 실시간 공동 편집

### 핵심 구도: "협업"과 "배포"의 분리

- **스페이스 = 협업 단위**: 살아있는 공동 작업 공간. 멤버 초대, 함께 수정, 실시간 동기화.
- **컬렉션 = 배포 단위**: 스냅샷 복사. 받는 순간 100% 받는 사람 소유가 되고 이후 서로 독립.

이 분리로 "내 개인 스페이스 안에 남의 실시간 컬렉션이 섞이는" 상황을 원천 차단한다. 권한 상속 규칙, 정렬 충돌, RLS 복잡도가 발생하지 않는다.

### 제약

- 익스텐션 단독 앱이므로 외부 웹 표면이 없다. 초대·코드 입력·수락 흐름은 전부 익스텐션(새 탭) 안에서 이루어지며, 받는 사람도 tablign 설치 + 로그인이 필수다.

### 아키텍처 선택

**멤버십 테이블 + RLS 확장** 방식을 채택한다 (Edge Function 게이트웨이, 공유 전용 테이블 분리 안은 기각).

- 클라이언트 데이터 계층(`packages/core`)이 `user_id`로 필터하지 않고 RLS에 위임하는 구조이므로, RLS만 멤버십 기반으로 확장하면 공유 스페이스가 사이드바에 자동으로 나타난다.
- Supabase Realtime은 RLS를 따르므로 공유 스페이스의 실시간 동기화가 기존 구독 코드로 자동 동작한다.

## 2. 데이터 모델

새 테이블 3개. 기존 테이블은 무수정.

```sql
-- 1) 스페이스 멤버십
create table space_members (
  space_id   uuid not null references spaces(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('editor', 'viewer')),
  position   double precision not null default 1000,  -- 내 사이드바 "공유됨" 섹션에서의 순서
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

-- 2) 스페이스 초대
create table space_invitations (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references spaces(id) on delete cascade,
  inviter_id    uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,           -- lower() 정규화하여 저장
  role          text not null check (role in ('editor', 'viewer')),
  status        text not null default 'pending'
                check (status in ('pending', 'accepted', 'declined')),
  created_at    timestamptz not null default now()
);
-- 중복 pending 초대 차단
create unique index space_invitations_pending_uniq
  on space_invitations(space_id, invitee_email) where status = 'pending';

-- 3) 컬렉션 공유 코드
create table collection_share_codes (
  code          text primary key,        -- 8자 영숫자(혼동 문자 제외)
  collection_id uuid not null references collections(id) on delete cascade,
  created_by    uuid not null references auth.users(id) on delete cascade,
  expires_at    timestamptz,             -- null = 무기한, 기본 발급은 7일
  revoked_at    timestamptz,             -- 발급자가 회수
  created_at    timestamptz not null default now()
);
```

### 설계 결정

- **오너는 `space_members`에 넣지 않는다.** `spaces.user_id`가 오너의 단일 진실 공급원. 멤버 테이블엔 editor/viewer만 들어간다. 기존 스페이스 백필 불필요, 고아 스페이스 위험 없음.
- **"공유 스페이스"는 플래그가 아니라 상태.** 멤버가 1명 이상이면 공유 스페이스다.
- **공유 스페이스 안에서 만든 컬렉션·링크의 `user_id`는 만든 사람.** 접근 권한은 멤버십으로 판정하고, `user_id`는 "누가 만들었나" 기록 용도.
- **초대는 이메일 문자열 매칭.** 가입 전 사용자에게도 초대를 걸 수 있고, 해당 이메일로 로그인하면 받은 초대가 보인다.
- **사이드바 정렬 이원화.** 개인 스페이스 순서 = `spaces.position`(기존), 공유됨 섹션 순서 = 내 `space_members.position`. 멤버마다 각자 순서를 가진다. 기존 DnD 정렬 코드(`packages/core/src/position.ts`)를 재사용한다.
- **태그는 끝까지 개인 소유(MVP).** 공유 스페이스에서 태그 UI는 숨기고, 컬렉션 복사 시 태그는 복사하지 않는다. 멤버 A가 붙인 태그 연결은 A에게만 보인다.

## 3. 권한 매트릭스

| 동작 | viewer | editor | owner |
|---|:-:|:-:|:-:|
| 스페이스·컬렉션·링크 보기 | ✅ | ✅ | ✅ |
| 컬렉션을 내 스페이스로 복사해가기 | ✅ | ✅ | ✅ |
| 컬렉션·링크 생성/수정/삭제/정렬 | ❌ | ✅ | ✅ |
| 컬렉션 공유 코드 발급 | ❌ | ✅ | ✅ |
| 스페이스 이름/아이콘 변경 | ❌ | ❌ | ✅ |
| 멤버 초대/제거/권한 변경 | ❌ | ❌ | ✅ |
| 스페이스 삭제 | ❌ | ❌ | ✅ |
| 스스로 나가기 | ✅ | ✅ | ❌ (MVP에선 삭제만, 양도는 추후) |

## 4. RLS / 보안 설계

### security definer 헬퍼 함수

정책 간 재귀(특히 `space_members` 정책이 자신을 참조)와 중복을 피하기 위해 판정 로직을 함수로 모은다.

```sql
-- 보기 권한: 오너이거나 멤버(역할 무관)
create function has_space_access(p_space_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from spaces where id = p_space_id and user_id = auth.uid())
        or exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid());
$$;

-- 아래 함수들도 has_space_access와 동일한 형태(security definer, stable)로 정의한다.
-- can_edit_space(p_space_id)        : 오너이거나 role = 'editor'
-- is_space_owner(p_space_id)        : spaces.user_id = auth.uid()
-- has_collection_access(p_coll_id)  : 컬렉션 → 스페이스 join 후 has_space_access
-- can_edit_collection(p_coll_id)    : 컬렉션 → 스페이스 join 후 can_edit_space
```

### 정책 변경 요약

기존 `auth.uid() = user_id` 단독 정책을 다음으로 교체한다.

| 테이블 | select | insert/update/delete |
|---|---|---|
| `spaces` | `has_space_access(id)` | 오너만 (기존 유지) |
| `collections` | `has_space_access(space_id)` | `can_edit_space(space_id)` |
| `links` | `has_collection_access(collection_id)` — 컬렉션 → 스페이스 join 헬퍼 | `can_edit_collection(collection_id)` |
| `space_members` | 같은 스페이스 접근자 | insert 오너만(RPC 경유), update 본인 행(position) 또는 오너(role), delete 오너 또는 본인(나가기) |
| `space_invitations` | 오너 또는 초대받은 본인(`auth.jwt()->>'email'` 소문자 매칭) | insert/delete 오너, 수락은 RPC로만 |
| `collection_share_codes` | 발급자만 | 발급은 `can_edit_space`, 회수는 발급자 |
| `profiles` | 본인 + 같은 스페이스를 공유하는 멤버끼리 | 본인만 (기존 유지) |
| `collection_tags` | 태그 소유자 본인 기준으로 유지 | 태그 소유자 본인 |

- **공유 코드 select가 "발급자만"인 이유**: 코드는 비밀값. 코드 입력 → 열람은 RPC가 security definer로 내부 조회한다.
- **role 셀프 승격 방지**: `space_members` update를 본인에게 열면 자기 role을 승격할 수 있으므로, `before update` 트리거로 "role 변경은 오너만" 가드를 건다 (RLS `with check`는 변경 전 값을 참조할 수 없음).

### RPC (security definer)

원자적 처리가 필요한 흐름만 RPC로 만들고 나머지는 일반 쿼리를 쓴다.

```
accept_invitation(invitation_id)
  → 호출자 이메일 = 초대 이메일 검증 → space_members insert + status 'accepted' (한 트랜잭션, 멱등)

copy_collection(collection_id, target_space_id)
  → 원본 읽기 권한 + 대상 편집 권한 검증 → 컬렉션·링크 딥카피 (user_id는 호출자, 태그 제외)
  → "내 스페이스 간 복사"가 직접 사용

move_collection(collection_id, target_space_id)
  → copy_collection과 대칭으로 원본·대상 권한 검증 → space_id 변경 + 대상 맨 아래 position

import_collection_by_code(code, target_space_id)
  → 코드 유효성(만료·회수) 검증 → 내부적으로 copy_collection 재사용
```

- **이동(move)도 RPC로 처리**: 당초 "RLS의 `with check`가 새 스페이스 편집권을 자동 검증하므로 update만으로 충분"으로 설계했으나, 그 전제는 3단계 RLS 개편 이후에만 성립한다(1단계 RLS는 `user_id`만 검사). 1단계부터 copy와 대칭인 `move_collection` RPC로 대상 스페이스 권한을 서버에서 강제한다. (구현 중 코드리뷰에서 발견되어 변경)

### Realtime

기존 publication에 `space_members`, `space_invitations`를 추가한다. Realtime은 RLS를 따르므로 공유 스페이스의 컬렉션·링크 변경이 멤버들에게 자동 전파되고, 초대 알림도 실시간으로 도착한다.

### Grants

`0005_grants.sql` 패턴에 따라 새 테이블·함수에 authenticated 권한을 부여한다.

## 5. 기능별 사용자 흐름

### 5-1. 내 스페이스 간 컬렉션 복사/이동 (구현 1단계)

- 컬렉션 헤더 `⋯` 메뉴에 "다른 스페이스로 이동", "다른 스페이스에 복사" 추가
- 클릭 → 스페이스 선택 팝오버(내가 편집 가능한 스페이스 목록) → 선택 즉시 실행
- 이동: `space_id` update (대상 스페이스 맨 아래 position) / 복사: `copy_collection` RPC
- 완료 토스트 표시. 실행 취소는 MVP 제외(복사는 삭제로, 이동은 재이동으로 복구 가능)

### 5-2. 컬렉션 공유 코드 (구현 2단계)

발급자:
- 컬렉션 `⋯` 메뉴 → "공유 코드 만들기" → 다이얼로그에 코드 + 복사 버튼
- 기본 7일 만료, 다이얼로그에서 무기한 선택 가능
- 기존 발급 코드가 있으면 재표시 + "회수" 버튼

받는 사람:
- 사이드바 하단 "코드로 가져오기" 진입점 → 코드 입력
- 유효 시 미리보기(컬렉션 이름 + 링크 개수 + 공유한 사람) → 대상 스페이스 선택 → 가져오기
- `import_collection_by_code` 실행 후 해당 스페이스로 이동

### 5-3. 공유 스페이스 협업 (구현 3단계)

초대하기 (오너):
- 스페이스 헤더 "멤버" 버튼 → 멤버 관리 다이얼로그
- 이메일 입력 + 역할 선택(편집자/뷰어) → 초대 생성
- 현재 멤버 목록(아바타·이름·역할) + 대기 중 초대 표시, 오너는 역할 변경·제거 가능

초대 받기:
- 새 탭 헤더 알림 배지 → 받은 초대 목록 → 수락/거절
- 수락 → `accept_invitation` → 사이드바 "공유됨" 섹션에 스페이스 등장

함께 쓰기:
- 공유 스페이스 UI는 기존과 동일하되 헤더에 멤버 아바타 스택 표시
- viewer는 추가/편집/삭제/DnD 진입점을 숨기거나 비활성화 (RLS가 최종 방어선, UI는 1차 방어선)
- 다른 멤버의 변경은 기존 Realtime 구독으로 자동 반영
- 사이드바 "공유됨" 섹션 내 DnD 정렬 → 내 `space_members.position` update

## 6. 엣지 케이스

### 초대

- 중복 pending 초대 → 부분 유니크 인덱스로 차단
- 이미 멤버인 사람·자기 자신 초대 → insert 전 검증, 명확한 에러 메시지
- 이메일 대소문자 → 저장·비교 모두 `lower()` 정규화
- 수락 시점에 이미 멤버(경합) → `accept_invitation` 멱등 처리

### 공유 코드

- 만료·회수된 코드 → "만료된 코드예요" 구분 메시지
- 원본 컬렉션 삭제 → FK cascade로 코드 소멸 → "존재하지 않는 코드"
- 내가 만든 코드를 내가 입력 → 허용 (내 스페이스 간 복사와 동일 효과)
- viewer도 코드로 가져가기 가능 (자기 스페이스로의 복사는 열람 권한으로 충분)

### 공유 스페이스

- 공유 스페이스 → 개인 스페이스로 컬렉션 이동: 다른 멤버 화면에서 사라지므로 확인 다이얼로그 표시
- 오너 계정 삭제 → cascade로 스페이스·멤버십 소멸 (MVP에선 감수, 양도는 추후)
- 멤버 role 셀프 승격 → 트리거 가드가 차단

## 7. 테스트

기존 `packages/core/src/__tests__/rls.test.ts` 패턴을 확장한다.

- **접근 매트릭스 테스트**: 오너/editor/viewer/비멤버 × 각 테이블 CRUD — 권한 매트릭스 표를 그대로 테스트로 옮김
- **RPC 테스트**: `accept_invitation`(이메일 불일치·중복 수락), `copy_collection`(권한 없는 원본/대상), `import_collection_by_code`(만료·회수·삭제된 코드)
- **트리거 테스트**: 멤버가 자기 role update 시도 → 거부

## 8. 구현 단계

설계는 통합, 구현은 쉬운 것부터 분리한다.

| 단계 | 내용 | 스키마 변경 |
|---|---|---|
| 1단계 | 내 스페이스 간 복사/이동 — `copy_collection` RPC + `⋯` 메뉴 UI | 없음 (RPC만) |
| 2단계 | 컬렉션 공유 코드 — `collection_share_codes` + `import_collection_by_code` + 발급/입력 UI | 테이블 1개 |
| 3단계 | 공유 스페이스 — `space_members`·`space_invitations` + RLS 전면 개편 + 헬퍼 함수 + 멤버 관리·초대 알림·공유됨 섹션·viewer 모드 UI | 가장 큼 |

- 1단계의 `copy_collection`이 2단계에서 재사용된다.
- RLS 개편은 3단계에만 있으므로 1·2단계는 기존 정책 그대로 안전하게 출시할 수 있다.

## 9. MVP에서 제외한 것 (추후 과제)

- 오너 양도 / 오너 나가기
- 복사·이동 실행 취소
- 태그 공유 (태그 소유권 모델 개편 필요)
- 초대 이메일 발송 (현재는 앱 내 알림만)
- 공유 코드 사용 횟수 제한·사용 이력
