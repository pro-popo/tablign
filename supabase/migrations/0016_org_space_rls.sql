-- 스페이스 접근·편집 판정을 조직 멤버십 기반으로 확장.
-- 기존 per-space 공유(space_members)는 개인 조직 스페이스에 대해서만 행이 존재하므로 그대로 유지.

create or replace function public.has_space_access(p_space_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from spaces s where s.id = p_space_id and public.has_org_access(s.org_id)
    )
    or exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid());
$$;

create or replace function public.can_edit_space(p_space_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from spaces s where s.id = p_space_id and public.can_edit_org(s.org_id)
    )
    or exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid() and role = 'editor');
$$;

-- spaces select: 인라인(INSERT RETURNING). 오너 본인 or per-space 멤버 or 조직 접근자.
drop policy "spaces_select" on public.spaces;
create policy "spaces_select" on public.spaces
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.space_members where space_id = spaces.id and user_id = auth.uid())
    or public.has_org_access(spaces.org_id)
  );

-- spaces write: 조직 편집권(owner/admin). insert는 본인 명의 + 대상 조직 편집권.
drop policy "spaces_insert" on public.spaces;
drop policy "spaces_update" on public.spaces;
drop policy "spaces_delete" on public.spaces;
create policy "spaces_insert" on public.spaces
  for insert with check (auth.uid() = user_id and public.can_edit_org(org_id));
create policy "spaces_update" on public.spaces
  for update using (public.can_edit_org(org_id)) with check (public.can_edit_org(org_id));
create policy "spaces_delete" on public.spaces
  for delete using (public.can_edit_org(org_id));
