-- per-space 공유는 개인 조직 스페이스에만 허용. 팀 조직 스페이스는 조직 멤버십으로만.

-- 1) invite_to_space에 개인 조직 가드 추가 (0012 본문 그대로 + 오너 체크 다음 한 줄).
create or replace function public.invite_to_space(p_space_id uuid, p_email text, p_role text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_invitee uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if coalesce(auth.jwt() ->> 'email', '') = '' then raise exception 'caller email required'; end if;
  if p_role not in ('editor', 'viewer') then raise exception 'invalid role'; end if;
  if not public.is_space_owner(p_space_id) then raise exception 'only the owner can invite'; end if;
  -- Phase 4: 팀 조직 스페이스는 per-space 초대 불가 (조직 멤버십으로 협업)
  if not public.is_personal_org_space(p_space_id) then
    raise exception 'team-org spaces are shared via organization membership, not per-space invite';
  end if;
  if v_email = lower(coalesce(auth.jwt() ->> 'email', '')) then raise exception 'cannot invite yourself'; end if;

  -- 이미 멤버인 이메일인지(가입된 사용자 한정) 확인
  select id into v_invitee from auth.users where lower(email) = v_email;
  if v_invitee is not null and exists (
    select 1 from space_members where space_id = p_space_id and user_id = v_invitee
  ) then
    raise exception 'already a member';
  end if;

  insert into space_invitations (space_id, inviter_id, invitee_email, role)
  values (p_space_id, v_uid, v_email, p_role)
  returning id into v_id;   -- 중복 pending은 부분 유니크 인덱스가 unique_violation으로 차단
  return v_id;
end;
$$;
-- (grant/revoke는 0012에서 이미 authenticated로 설정됨 — create or replace는 유지)

-- 2) 방어적 이중화: space_members insert 시 대상 스페이스가 개인 조직이 아니면 거부.
--    (accept_invitation RPC가 유일한 insert 경로지만, 만일을 대비.)
create function public.guard_space_member_org() returns trigger
  language plpgsql set search_path = public as $$
begin
  if not public.is_personal_org_space(new.space_id) then
    raise exception 'space_members is only for personal-org spaces';
  end if;
  return new;
end;
$$;
create trigger space_members_personal_org_guard
  before insert on public.space_members
  for each row execute function public.guard_space_member_org();
