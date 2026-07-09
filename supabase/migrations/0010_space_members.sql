-- 공유 스페이스 3단계: 멤버십·초대 테이블 + RLS 판정 헬퍼 + 새 테이블 정책

-- 1) 스페이스 멤버십 (오너는 넣지 않음 — spaces.user_id가 오너의 단일 진실 공급원)
create table public.space_members (
  space_id   uuid not null references public.spaces(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('editor', 'viewer')),
  position   double precision not null default 1000,  -- 내 사이드바 "공유됨" 섹션 순서
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index space_members_user_id_idx on public.space_members(user_id);

-- 2) 스페이스 초대
create table public.space_invitations (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces(id) on delete cascade,
  inviter_id    uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,             -- lower() 정규화 저장
  role          text not null check (role in ('editor', 'viewer')),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at    timestamptz not null default now()
);
create index space_invitations_space_id_idx on public.space_invitations(space_id);
create index space_invitations_email_idx on public.space_invitations(invitee_email);
-- 같은 스페이스에 같은 이메일 pending 초대 중복 차단
create unique index space_invitations_pending_uniq
  on public.space_invitations(space_id, invitee_email) where status = 'pending';

-- 3) RLS 판정 헬퍼 (security definer라 정책 내부에서 space_members를 읽어도 RLS 재귀가 끊긴다)
create function public.has_space_access(p_space_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from spaces where id = p_space_id and user_id = auth.uid())
        or exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid());
$$;

create function public.can_edit_space(p_space_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from spaces where id = p_space_id and user_id = auth.uid())
        or exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid() and role = 'editor');
$$;

create function public.is_space_owner(p_space_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from spaces where id = p_space_id and user_id = auth.uid());
$$;

create function public.has_collection_access(p_collection_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from collections c where c.id = p_collection_id and public.has_space_access(c.space_id)
    );
$$;

create function public.can_edit_collection(p_collection_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from collections c where c.id = p_collection_id and public.can_edit_space(c.space_id)
    );
$$;

-- 두 사용자가 공유하는 스페이스가 있는가 (profiles 상호 열람용)
create function public.shares_space_with(p_other uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    with mine as (
      select id as sid from spaces where user_id = auth.uid()
      union select space_id from space_members where user_id = auth.uid()
    ), theirs as (
      select id as sid from spaces where user_id = p_other
      union select space_id from space_members where user_id = p_other
    )
    select exists (select 1 from mine m join theirs t on m.sid = t.sid);
$$;

-- 4) role 셀프 승격 방지: update로 role을 바꾸는 건 오너만 (position 변경은 허용)
create function public.guard_member_role_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.space_id <> old.space_id then
    raise exception 'space_id cannot be changed';
  end if;
  if new.role <> old.role and not public.is_space_owner(old.space_id) then
    raise exception 'only the owner can change member role';
  end if;
  return new;
end;
$$;
create trigger space_members_role_guard
  before update on public.space_members
  for each row execute function public.guard_member_role_update();

-- 5) 새 테이블 RLS
alter table public.space_members enable row level security;
alter table public.space_invitations enable row level security;

-- space_members: select=같은 스페이스 접근자, insert 정책 없음(수락 RPC 경유),
--                update=본인(position)·오너(role), delete=오너 또는 본인(나가기)
create policy "space_members_select" on public.space_members
  for select using (public.has_space_access(space_id));
create policy "space_members_update" on public.space_members
  for update using (public.is_space_owner(space_id) or user_id = auth.uid())
  with check (public.is_space_owner(space_id) or user_id = auth.uid());
create policy "space_members_delete" on public.space_members
  for delete using (public.is_space_owner(space_id) or user_id = auth.uid());

-- space_invitations: select=오너 또는 초대받은 본인(이메일 매칭), delete=오너
--                    insert/수락/거절은 RPC(security definer) 경유 → 정책 없음
create policy "space_invitations_select" on public.space_invitations
  for select using (
    public.is_space_owner(space_id)
    or lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
create policy "space_invitations_delete" on public.space_invitations
  for delete using (public.is_space_owner(space_id));

-- 6) Realtime (RLS를 따르므로 멤버·초대 변경이 자동 전파)
alter publication supabase_realtime add table public.space_members;
alter publication supabase_realtime add table public.space_invitations;

-- 7) service_role 권한 (테스트 seeding용)
grant select, insert, update, delete on public.space_members to service_role;
grant select, insert, update, delete on public.space_invitations to service_role;
