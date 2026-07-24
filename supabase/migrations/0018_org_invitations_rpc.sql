-- 조직 초대 RPC — invite_to_space(0012)·get_my_invitations(0013) 대칭

-- 초대 생성: owner·admin만, 자기 자신·기존 멤버·오너 초대 차단, 이메일 소문자 정규화
create function public.invite_to_org(p_org_id uuid, p_email text, p_role text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(p_email);
  v_invitee uuid;
  v_id uuid;
begin
  if p_role not in ('admin','member') then raise exception 'invalid role'; end if;
  if not public.can_edit_org(p_org_id) then raise exception 'only owner or admin can invite'; end if;
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

-- 수락: 호출자 이메일 = 초대 이메일 검증 → 멤버 insert + status 갱신 (멱등)
create function public.accept_org_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email',''));
  v_inv organization_invitations;
begin
  select * into v_inv from organization_invitations where id = p_invitation_id;
  if v_inv is null or lower(v_inv.invitee_email) <> v_email then
    raise exception 'invitation not found';
  end if;
  if v_inv.status = 'declined' then raise exception 'invitation already declined'; end if;
  insert into organization_members (org_id, user_id, role)
  values (v_inv.org_id, v_uid, v_inv.role)
  on conflict (org_id, user_id) do nothing;
  update organization_invitations set status = 'accepted' where id = p_invitation_id;
end;
$$;
revoke execute on function public.accept_org_invitation(uuid) from public, anon;
grant execute on function public.accept_org_invitation(uuid) to authenticated;

-- 거절
create function public.decline_org_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email',''));
  v_inv organization_invitations;
begin
  select * into v_inv from organization_invitations where id = p_invitation_id;
  if v_inv is null or lower(v_inv.invitee_email) <> v_email then
    raise exception 'invitation not found';
  end if;
  update organization_invitations set status = 'declined' where id = p_invitation_id;
end;
$$;
revoke execute on function public.decline_org_invitation(uuid) from public, anon;
grant execute on function public.decline_org_invitation(uuid) to authenticated;

-- 나에게 온 pending 초대 (조직 이름 포함) — 초대받은 사람은 아직 org 멤버가 아니라 organizations RLS 미통과
create function public.get_my_org_invitations()
returns table(id uuid, org_id uuid, inviter_id uuid, invitee_email text, role text, status text, created_at timestamptz, org_name text)
language sql security definer stable set search_path = public as $$
  select oi.id, oi.org_id, oi.inviter_id, oi.invitee_email, oi.role, oi.status, oi.created_at, o.name as org_name
  from organization_invitations oi
  join organizations o on o.id = oi.org_id
  where oi.status = 'pending'
    and lower(oi.invitee_email) = lower(coalesce(auth.jwt() ->> 'email',''))
  order by oi.created_at desc;
$$;
revoke execute on function public.get_my_org_invitations() from public, anon;
grant execute on function public.get_my_org_invitations() to authenticated;
