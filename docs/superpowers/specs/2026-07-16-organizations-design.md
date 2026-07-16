# 조직(Organization) 설계

- 작성일: 2026-07-16
- 상태: 설계 승인 대기
- 선행: [공유 기능 설계](2026-07-03-sharing-design.md) (스페이스 협업 3단계 완료 위에 얹음)

## 1. 목표와 범위

tablign을 개인·개별 공유 도구에서 **팀 워크스페이스**로 확장한다. "조직"을 스페이스의 상위 소속 단위로 도입해, 팀을 만들고 멤버를 초대하면 그 조직의 스페이스들을 멤버가 자동으로 함께 쓴다.

### 핵심 구도

- **조직 = 팀 워크스페이스**: 멤버는 조직의 공개 스페이스를 자동으로 공유받는다. 스페이스마다 개별 초대할 필요가 없다.
- **모든 스페이스는 정확히 하나의 조직에 소속**된다. 유저는 가입 시 **개인 조직**(`is_personal`)을 자동으로 하나 받고, 개인 스페이스는 전부 여기 소속된다.
- 유저는 개인 조직 + 여러 팀 조직에 속할 수 있고, 사이드바 레일로 조직을 전환한다.

### 세 가지 공유 메커니즘의 역할 분리

조직 도입으로 기존 공유 기능과 겹치지 않도록 역할을 나눈다.

- **조직 멤버십** = 팀 내부의 *살아있는 협업* (실시간 공동 편집).
- **per-space 공유 (기존 `space_members`)** = 조직을 만들 필요 없이 **개인 조직 스페이스 하나**를 외부인과 가볍게 공유. **팀 조직 스페이스에는 불가**(가드로 강제).
- **컬렉션 공유 코드 (기존)** = 경계를 넘는 *일방향 스냅샷 배포*. 전역 유지. 조직 밖으로 내보내려면 명시적으로 이 경로를 거친다.

이 분리로 조직 콘텐츠가 조직 밖으로 개별 유출되는 경로를 원천 차단한다.

### 제약

- 익스텐션 단독 앱이므로 외부 웹 표면이 없다. 조직 생성·초대·수락은 전부 익스텐션(새 탭) 안에서 이뤄지며, 초대받는 사람도 tablign 설치 + 로그인이 필수다.

### 아키텍처 선택

기존 공유 설계와 동일하게 **멤버십 테이블 + RLS 확장** 방식을 이어간다. 클라이언트 데이터 계층이 `user_id`로 필터하지 않고 RLS에 위임하므로, RLS를 조직 멤버십 기반으로 확장하면 조직 스페이스가 사이드바에 자동으로 나타나고 Realtime도 그대로 동작한다.

## 2. 데이터 모델

새 테이블 3개(기존 `space_*` 공유 테이블과 대칭). 기존 테이블은 컬럼 2개만 추가.

```sql
-- 1) 조직
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  icon        text,                       -- 이니셜/이모지 등
  color       text,                       -- 아바타 배경색
  owner_id    uuid not null references auth.users(id) on delete cascade,
  is_personal boolean not null default false,
  created_at  timestamptz not null default now()
);
create index organizations_owner_id_idx on organizations(owner_id);
-- 유저당 개인 조직은 하나만
create unique index organizations_personal_uniq
  on organizations(owner_id) where is_personal;

-- 2) 조직 멤버십 (오너는 넣지 않음 — organizations.owner_id가 오너의 단일 진실 공급원)
create table organization_members (
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin', 'member')),
  position   double precision not null default 1000,  -- 내 레일에서의 조직 순서
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index organization_members_user_id_idx on organization_members(user_id);

-- 3) 조직 초대 (이메일 문자열 매칭 — 기존 space_invitations와 동일 패턴)
create table organization_invitations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  inviter_id    uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,            -- lower() 정규화 저장
  role          text not null check (role in ('admin', 'member')),
  status        text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at    timestamptz not null default now()
);
create unique index organization_invitations_pending_uniq
  on organization_invitations(org_id, invitee_email) where status = 'pending';

-- 기존 테이블 수정
alter table spaces      add column org_id uuid references organizations(id) on delete cascade;  -- 백필 후 not null
alter table collections add column is_private boolean not null default false;
create index spaces_org_id_idx on spaces(org_id);
```

### 설계 결정

- **오너는 `organization_members`에 넣지 않는다.** `organizations.owner_id`가 오너의 단일 진실 공급원. 멤버 테이블엔 admin/member만. (기존 `spaces.user_id` ↔ `space_members` 패턴과 동일)
- **개인 조직은 `is_personal=true` 상태로 표현.** 유저당 하나(부분 유니크 인덱스), 멤버·초대 없음, 삭제 불가.
- **스페이스는 org에 소속.** `spaces.org_id`는 백필 후 not null. `spaces.user_id`는 "누가 만들었나" 기록 용도로 유지(접근 판정은 조직 멤버십으로).
- **비공개는 컬렉션 단위.** `collections.is_private`. 비공개 컬렉션은 권한과 무관하게 생성자(`collections.user_id`)만 열람·편집. 멤버는 읽기 전용이라 컬렉션을 못 만들므로 비공개 컬렉션은 사실상 owner/admin이 만든다.
- **스페이스 간·조직 간 이동은 MVP 제외.** 스페이스는 만들어진 조직에 고정.

## 3. 권한 매트릭스

| 동작 | member | admin | owner |
|---|:-:|:-:|:-:|
| 공개 스페이스·컬렉션·링크 보기 | ✅ | ✅ | ✅ |
| 스페이스 생성/이름·아이콘 변경/삭제 | ❌ | ✅ | ✅ |
| 컬렉션·링크 생성/수정/삭제/정렬 | ❌ | ✅ | ✅ |
| 컬렉션을 내 스페이스로 복사해가기 | ✅ | ✅ | ✅ |
| 비공개 컬렉션 열람·편집 | 생성자 본인만 | 생성자 본인만 | 생성자 본인만 |
| 멤버 초대/제거/권한 변경 | ❌ | ✅ | ✅ |
| 조직 이름/아이콘 변경 | ❌ | ✅ | ✅ |
| 조직 삭제 | ❌ | ❌ | ✅ |
| 스스로 나가기 | ✅ | ✅ | ❌ (MVP: 삭제만, 양도는 추후) |

- **개인 조직**: 오너(본인)만 존재. 멤버·초대 UI 없음. 편집 = 오너, 그리고 per-space 공유로 초대된 editor(기존 기능).
- **비공개 컬렉션**은 권한 매트릭스를 관통한다 — owner라도 남이 만든 비공개 컬렉션은 못 본다.

## 4. RLS / 보안 설계

### security definer 헬퍼 함수 (신규)

```sql
-- 조직 보기 권한: 오너이거나 멤버(역할 무관)
create function has_org_access(p_org_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from organizations where id = p_org_id and owner_id = auth.uid())
        or exists (select 1 from organization_members where org_id = p_org_id and user_id = auth.uid());
$$;

-- 아래도 동일 형태(security definer, stable):
-- can_edit_org(p_org_id)  : 오너이거나 role = 'admin'
-- is_org_owner(p_org_id)  : organizations.owner_id = auth.uid()
-- is_personal_org_space(p_space_id) : 스페이스 → org join 후 organizations.is_personal
```

### 기존 헬퍼 재작성

기존 `has_space_access` / `can_edit_space`(0010)를 **조직 멤버십 + 개인 조직 per-space 공유** 를 모두 보도록 교체한다.

```sql
-- 보기: 스페이스 org 접근권 OR (개인 조직 스페이스에 대한 per-space 멤버십)
create or replace function has_space_access(p_space_id uuid) returns boolean ... as $$
  select exists (select 1 from spaces s where s.id = p_space_id and public.has_org_access(s.org_id))
      or exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid());
$$;

-- 편집: 스페이스 org 편집권 OR per-space editor
create or replace function can_edit_space(p_space_id uuid) returns boolean ... as $$
  select exists (select 1 from spaces s where s.id = p_space_id and public.can_edit_org(s.org_id))
      or exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid() and role = 'editor');
$$;
```

`space_members` 경로는 개인 조직 스페이스에만 행이 존재한다(§4 가드). 팀 조직 스페이스는 org 멤버십으로만 판정된다.

### 컬렉션 비공개 오버레이

```sql
-- 비공개면 생성자 본인만, 아니면 스페이스 접근권
create or replace function has_collection_access(p_coll_id uuid) returns boolean ... as $$
  select exists (
    select 1 from collections c where c.id = p_coll_id
      and (case when c.is_private then c.user_id = auth.uid()
                else public.has_space_access(c.space_id) end)
  );
$$;
-- can_edit_collection도 동일 오버레이: 비공개면 생성자 본인, 아니면 can_edit_space
```

`links` 정책은 기존대로 `has_collection_access` / `can_edit_collection`에 위임하므로 비공개가 자동 상속된다.

### 신규 테이블 RLS (기존 space_* 정책과 대칭)

| 테이블 | select | insert/update/delete |
|---|---|---|
| `organizations` | `has_org_access(id)` | insert=본인 소유로만, update=`can_edit_org`, delete=`is_org_owner` **且** `not is_personal` |
| `organization_members` | 같은 조직 접근자 | insert 정책 없음(수락 RPC 경유), update 본인 행(position)·오너(role), delete 오너 또는 본인(나가기) |
| `organization_invitations` | 오너·admin 또는 초대받은 본인(이메일 매칭) | insert/수락은 RPC 경유(정책 없음), delete 오너·admin |

- **role 셀프 승격 방지**: `organization_members`에 `before update` 트리거로 "role 변경은 오너·admin만"(기존 `guard_member_role_update` 패턴).
- **개인 조직 삭제 차단**: `organizations` delete 정책에 `not is_personal`.

### per-space 공유를 개인 조직으로 제한 (가드)

팀 조직 스페이스에는 per-space 초대를 금지한다. `space_invitations`엔 insert RLS 정책이 없어 **`invite_to_space` RPC(0012)가 유일한 생성 경로**이므로, 거기에 조건 한 줄을 추가하는 것이 실질 방어선이다.

```sql
-- invite_to_space 안, 기존 is_space_owner 체크 다음
if not public.is_personal_org_space(p_space_id) then
  raise exception 'team-org spaces are shared via organization membership, not per-space invite';
end if;
```

**방어적 이중화**: `space_members`에 `before insert` 트리거를 추가해 "대상 스페이스 org가 개인 조직이 아니면 거부"(멤버 추가 경로 `accept_invitation`도 이 테이블만 거침).

### RPC (신규, 기존 대칭)

```
invite_to_org(org_id, email, role)
  → 오너·admin 검증 → 자기 자신·기존 멤버 차단 → organization_invitations insert (invite_to_space 대칭)
accept_org_invitation(invitation_id)
  → 호출자 이메일 = 초대 이메일 검증 → organization_members insert + status 'accepted' (멱등)
decline_org_invitation(invitation_id)
get_my_org_invitations()
  → 초대받은 사람은 아직 org 멤버가 아니라 organizations RLS를 통과 못 하므로 조직 이름을 security definer로 취득 (기존 get_my_invitations 대칭)
```

### Realtime / Grants

- publication에 `organizations`, `organization_members`, `organization_invitations` 추가.
- `0005_grants.sql` 패턴에 따라 신규 테이블·함수에 authenticated 권한 부여, service_role seeding 권한.

## 5. 마이그레이션 / 백필

1. 신규 테이블 3개 + 헬퍼 함수 + RLS 생성.
2. `spaces.org_id`(nullable), `collections.is_private` 컬럼 추가.
3. **백필**: 모든 `profiles`에 대해 개인 조직 생성(`is_personal=true`, `name='개인'`, `owner_id=profile.id`) → 해당 유저의 모든 스페이스 `org_id`를 그 개인 조직으로 설정.
4. `spaces.org_id` not null 승격.
5. `handle_new_user` 트리거 확장: 신규 가입 시 profiles insert에 이어 개인 조직도 생성.
6. 기존 `has_space_access` / `can_edit_space` / `has_collection_access` / `can_edit_collection` 재작성, `invite_to_space` 가드 추가.

- 기존 `space_members` 행은 전부 개인 조직 스페이스에 대한 것이 되므로(모든 기존 스페이스가 개인 조직으로 백필됨) 재작성된 RLS와 정합.

## 6. UI

확정된 시안: **좌측 확장 레일 + 협업 헤더** (docs/design 목업 참조).

- **레일(resting 54px, hover 196px 확장)**: 최상단 tablign 로고 → 구분선 → 개인(앰버 집 아이콘)·팀 조직 아이콘·"조직 만들기"(＋) → 하단에 내 계정. hover 시 조직 이름·워드마크·이메일이 아이콘 옆으로 펼쳐진다. 조직 순서 = 내 `organization_members.position`(개인은 항상 최상단).
- **패널 헤더**:
  - 팀 조직: 조직명 + 멤버 아바타 스택 + 내 역할칩(소유자 주황 / 관리자 파랑 / 멤버 회색) + ⚙️(멤버 관리·조직 설정).
  - 개인 조직: 이름 + ⚙️(이름·삭제만). 멤버/역할 없음.
- **SPACES 목록**: 현재 조직의 스페이스. 비공개 컬렉션이 있는 스페이스에 🔒 표시.
- **멤버 관리 다이얼로그**: 이메일+역할 초대, 현재 멤버 목록(아바타·이름·역할), 대기 초대, 오너·admin의 역할 변경·제거. 기존 스페이스 멤버 다이얼로그 UI 재사용.
- **초대 받기**: 기존 초대 알림 배지에 조직 초대도 합류(수락 시 레일에 조직 등장).
- **컬렉션 비공개 토글**: 컬렉션 `⋯` 메뉴에 "비공개" 토글 + 🔒 표시.
- **활성 조직 상태 유지**: 기존 활성 스페이스 방식(`useActiveSpace`) 확장.
- viewer(=member)는 생성/편집/삭제/DnD 진입점을 숨기거나 비활성화(RLS가 최종 방어선).

## 7. 구현 단계

| 단계 | 내용 | 스키마 변경 |
|---|---|---|
| 1 | **조직 기반**: 신규 테이블 + 개인 조직 백필 + `spaces.org_id` + 헬퍼/RLS 재작성 + 레일 UI + 조직 생성/전환 | 큼 (테이블 3 + 컬럼 + 백필 + RLS) |
| 2 | **조직 멤버십**: `invite_to_org`·`accept_org_invitation` 등 RPC + 멤버 관리 UI + 역할칩 + 초대 알림 합류 + Realtime | RPC·정책 |
| 3 | **컬렉션 비공개**: `collections.is_private` 오버레이 + 토글 UI + 🔒 | 컬렉션 오버레이 |
| 4 | **per-space 제한**: `invite_to_space` 가드 + `space_members` insert 트리거 + 팀 스페이스에서 per-space 공유 UI 숨김 | 가드·트리거 |

- 1단계 RLS 재작성 시점부터 기존 개인 스페이스는 개인 조직 소속으로 동작(무중단).
- 3·4단계는 독립적이라 순서 바꿔도 무방.

## 8. 테스트

기존 `packages/core/src/__tests__/rls.test.ts` 패턴을 확장한다.

- **조직 접근 매트릭스**: owner/admin/member/비멤버 × 조직·스페이스·컬렉션·링크 CRUD — §3 표를 그대로 테스트로.
- **비공개 컬렉션**: 생성자만 열람·편집, owner/admin도 남의 비공개는 차단.
- **RPC**: `accept_org_invitation`(이메일 불일치·중복 수락 멱등), `invite_to_org`(자기 자신·기존 멤버·권한 없음).
- **가드**: 팀 조직 스페이스에 `invite_to_space` 호출 → 거부. `space_members` 팀 스페이스 insert → 트리거 거부.
- **트리거**: 멤버의 자기 role 승격 → 거부. 개인 조직 삭제 → 거부.
- **백필**: 마이그레이션 후 모든 기존 스페이스에 `org_id` 존재, 유저별 개인 조직 1개.

## 9. MVP에서 제외한 것 (추후 과제)

- 오너 양도 / 오너 나가기
- 조직 초대 링크·코드(현재는 이메일 초대만)
- 스페이스를 조직 간 이동
- 스페이스별 세분 admin(설계 중 폐기 — 권한은 조직 역할 + 컬렉션 비공개로 단순화)
- 태그 공유(태그 소유권 모델 개편 필요 — 기존 공유 설계와 동일하게 보류)
- 조직 초대 이메일 발송(현재는 앱 내 알림만)
