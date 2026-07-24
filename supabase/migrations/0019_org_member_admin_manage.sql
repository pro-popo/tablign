-- 조직 admin 멤버 관리 권한 허용: 멤버 제거·role 변경을 owner 전용에서 owner·admin으로 확장
-- (스펙 §3 권한 매트릭스: 멤버 제거/권한 변경 = admin ✅, owner ✅)
-- 셀프 승격은 계속 차단(guard_org_member_role_update가 can_edit_org 기준으로 검증)

drop policy "organization_members_update" on public.organization_members;
create policy "organization_members_update" on public.organization_members
  for update using (public.can_edit_org(org_id) or user_id = auth.uid())
  with check (public.can_edit_org(org_id) or user_id = auth.uid());

drop policy "organization_members_delete" on public.organization_members;
create policy "organization_members_delete" on public.organization_members
  for delete using (public.can_edit_org(org_id) or user_id = auth.uid());

create or replace function public.guard_org_member_role_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.org_id <> old.org_id then raise exception 'org_id cannot be changed'; end if;
  if new.role <> old.role and not public.can_edit_org(old.org_id) then
    raise exception 'only owner or admin can change member role';
  end if;
  return new;
end;
$$;
