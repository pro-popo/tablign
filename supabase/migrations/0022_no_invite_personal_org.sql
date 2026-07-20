-- 개인 조직에는 멤버 초대를 만들 수 없도록 invite_to_org에 가드 추가(0018 본문 + 가드 1줄)

-- 초대 생성: owner·admin만, 자기 자신·기존 멤버·오너 초대 차단, 이메일 소문자 정규화, 개인 조직 초대 차단
create or replace function public.invite_to_org(p_org_id uuid, p_email text, p_role text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(p_email);
  v_invitee uuid;
  v_id uuid;
begin
  if p_role not in ('admin','member') then raise exception 'invalid role'; end if;
  if not public.can_edit_org(p_org_id) then raise exception 'only owner or admin can invite'; end if;
  if exists (select 1 from organizations where id = p_org_id and is_personal) then
    raise exception 'cannot invite members to a personal org';
  end if;
  if v_email = lower(coalesce(auth.jwt() ->> 'email','')) then raise exception 'cannot invite yourself'; end if;

  select id into v_invitee from auth.users where lower(email) = v_email;
  if v_invitee is not null then
    if exists (select 1 from organizations where id = p_org_id and owner_id = v_invitee) then
      raise exception 'user is already the owner';
    end if;
    if exists (select 1 from organization_members where org_id = p_org_id and user_id = v_invitee) then
      raise exception 'user is already a member';
    end if;
  end if;

  insert into organization_invitations (org_id, inviter_id, invitee_email, role)
  values (p_org_id, v_uid, v_email, p_role)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.invite_to_org(uuid, text, text) from public, anon;
grant execute on function public.invite_to_org(uuid, text, text) to authenticated;
