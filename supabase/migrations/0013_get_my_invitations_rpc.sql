-- 나에게 온 pending 초대 목록 (스페이스 이름 포함).
-- 초대받은 사람은 space_members에 없으므로 spaces RLS를 통과하지 못한다.
-- security definer로 스페이스 이름을 join해 반환한다.
create function public.get_my_invitations()
returns table(
  id            uuid,
  space_id      uuid,
  inviter_id    uuid,
  invitee_email text,
  role          text,
  status        text,
  created_at    timestamptz,
  space_name    text
)
language sql security definer stable set search_path = public as $$
  select
    si.id,
    si.space_id,
    si.inviter_id,
    si.invitee_email,
    si.role,
    si.status,
    si.created_at,
    s.name as space_name
  from space_invitations si
  join spaces s on s.id = si.space_id
  where si.status = 'pending'
    and lower(si.invitee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by si.created_at desc;
$$;
revoke execute on function public.get_my_invitations() from public, anon;
grant execute on function public.get_my_invitations() to authenticated;
