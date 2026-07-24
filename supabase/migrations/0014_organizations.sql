-- 조직 1단계: 테이블 + 판정 헬퍼 + 조직 테이블 RLS

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  icon        text,
  color       text,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  is_personal boolean not null default false,
  created_at  timestamptz not null default now()
);
create index organizations_owner_id_idx on public.organizations(owner_id);
create unique index organizations_personal_uniq
  on public.organizations(owner_id) where is_personal;

create table public.organization_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin', 'member')),
  position   double precision not null default 1000,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index organization_members_user_id_idx on public.organization_members(user_id);

create table public.organization_invitations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  inviter_id    uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  role          text not null check (role in ('admin', 'member')),
  status        text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at    timestamptz not null default now()
);
create index organization_invitations_org_id_idx on public.organization_invitations(org_id);
create index organization_invitations_email_idx on public.organization_invitations(invitee_email);
create unique index organization_invitations_pending_uniq
  on public.organization_invitations(org_id, invitee_email) where status = 'pending';

create function public.has_org_access(p_org_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from organizations where id = p_org_id and owner_id = auth.uid())
        or exists (select 1 from organization_members where org_id = p_org_id and user_id = auth.uid());
$$;

create function public.can_edit_org(p_org_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from organizations where id = p_org_id and owner_id = auth.uid())
        or exists (select 1 from organization_members where org_id = p_org_id and user_id = auth.uid() and role = 'admin');
$$;

create function public.is_org_owner(p_org_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from organizations where id = p_org_id and owner_id = auth.uid());
$$;

-- 스페이스가 개인 조직에 속하는가 (per-space 공유 가드·후속 Phase에서 재사용)
-- NOTE: spaces.org_id는 Task 2(0015)에서 추가된다. language sql 함수는 CREATE 시점에
-- 본문 쿼리를 카탈로그에 대해 즉시 분석하므로 아직 없는 컬럼을 참조하면 마이그레이션이 실패한다.
-- plpgsql은 최초 호출 시점에만 검증하므로 이 함수가 실제 배선되는 Task 2 이후까지 안전하게 미룰 수 있다.
create function public.is_personal_org_space(p_space_id uuid) returns boolean
  language plpgsql security definer stable set search_path = public as $$
begin
  return exists (
    select 1 from spaces s join organizations o on o.id = s.org_id
    where s.id = p_space_id and o.is_personal
  );
end;
$$;

-- role 셀프 승격 방지 (space_members 패턴)
create function public.guard_org_member_role_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.org_id <> old.org_id then raise exception 'org_id cannot be changed'; end if;
  if new.role <> old.role and not public.is_org_owner(old.org_id) then
    raise exception 'only the owner can change member role';
  end if;
  return new;
end;
$$;
create trigger organization_members_role_guard
  before update on public.organization_members
  for each row execute function public.guard_org_member_role_update();

alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.organization_invitations enable row level security;

-- organizations: select=접근자(INSERT RETURNING 위해 인라인), insert=본인 소유·팀 조직만,
--                update=owner·admin, delete=owner이며 개인 조직 아님
create policy "organizations_select" on public.organizations
  for select using (
    owner_id = auth.uid()
    or exists (select 1 from organization_members m where m.org_id = organizations.id and m.user_id = auth.uid())
  );
create policy "organizations_insert" on public.organizations
  for insert with check (owner_id = auth.uid() and is_personal = false);
create policy "organizations_update" on public.organizations
  for update using (public.can_edit_org(id)) with check (public.can_edit_org(id));
create policy "organizations_delete" on public.organizations
  for delete using (public.is_org_owner(id) and not is_personal);

-- organization_members: select=같은 조직 접근자, insert 정책 없음(수락 RPC는 Phase 2),
--                       update=본인(position)·owner(role), delete=owner 또는 본인(나가기)
create policy "organization_members_select" on public.organization_members
  for select using (public.has_org_access(org_id));
create policy "organization_members_update" on public.organization_members
  for update using (public.is_org_owner(org_id) or user_id = auth.uid())
  with check (public.is_org_owner(org_id) or user_id = auth.uid());
create policy "organization_members_delete" on public.organization_members
  for delete using (public.is_org_owner(org_id) or user_id = auth.uid());

-- organization_invitations: select=owner·admin 또는 초대받은 본인, delete=owner·admin
create policy "organization_invitations_select" on public.organization_invitations
  for select using (
    public.can_edit_org(org_id)
    or lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
create policy "organization_invitations_delete" on public.organization_invitations
  for delete using (public.can_edit_org(org_id));

alter publication supabase_realtime add table public.organizations;
alter publication supabase_realtime add table public.organization_members;
alter publication supabase_realtime add table public.organization_invitations;

-- authenticated 실행 권한 (0005 패턴)
grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.organization_invitations to authenticated;
grant execute on function public.has_org_access(uuid) to authenticated;
grant execute on function public.can_edit_org(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.is_personal_org_space(uuid) to authenticated;

-- service_role seeding (테스트)
grant select, insert, update, delete on public.organizations to service_role;
grant select, insert, update, delete on public.organization_members to service_role;
grant select, insert, update, delete on public.organization_invitations to service_role;
