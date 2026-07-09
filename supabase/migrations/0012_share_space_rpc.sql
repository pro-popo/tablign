-- 초대 RPC + 2단계 RPC를 멤버십 헬퍼 기반으로 교체

-- 초대 생성: 오너만, 자기 자신·기존 멤버·중복 pending 차단, 이메일 소문자 정규화
create function public.invite_to_space(p_space_id uuid, p_email text, p_role text)
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
revoke execute on function public.invite_to_space(uuid, text, text) from public, anon;
grant execute on function public.invite_to_space(uuid, text, text) to authenticated;

-- 초대 수락: 호출자 이메일 = 초대 이메일 검증 → 멤버 insert + status 갱신 (멱등)
create function public.accept_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_inv record;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if coalesce(auth.jwt() ->> 'email', '') = '' then raise exception 'caller email required'; end if;
  select * into v_inv from space_invitations where id = p_invitation_id;
  if v_inv is null or lower(v_inv.invitee_email) <> v_email then
    raise exception 'invitation not found';
  end if;
  if v_inv.status = 'declined' then raise exception 'invitation already declined'; end if;

  insert into space_members (space_id, user_id, role)
  values (v_inv.space_id, v_uid, v_inv.role)
  on conflict (space_id, user_id) do nothing;  -- 멱등
  update space_invitations set status = 'accepted' where id = p_invitation_id;
end;
$$;
revoke execute on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- 초대 거절
create function public.decline_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_inv record;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if coalesce(auth.jwt() ->> 'email', '') = '' then raise exception 'caller email required'; end if;
  select * into v_inv from space_invitations where id = p_invitation_id;
  if v_inv is null or lower(v_inv.invitee_email) <> v_email then
    raise exception 'invitation not found';
  end if;
  update space_invitations set status = 'declined' where id = p_invitation_id;
end;
$$;
revoke execute on function public.decline_invitation(uuid) from public, anon;
grant execute on function public.decline_invitation(uuid) to authenticated;

-- ── 2단계 RPC 헬퍼 기반 교체 (editor도 공유 스페이스에서 사용 가능) ──

create or replace function public.copy_collection(p_collection_id uuid, p_target_space_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not public.has_collection_access(p_collection_id) then raise exception 'source collection not found or not accessible'; end if;
  if not public.can_edit_space(p_target_space_id) then raise exception 'target space not found or not editable'; end if;
  return copy_collection_rows(p_collection_id, p_target_space_id, v_uid);
end;
$$;
revoke execute on function public.copy_collection(uuid, uuid) from public, anon;
grant execute on function public.copy_collection(uuid, uuid) to authenticated;

create or replace function public.move_collection(p_collection_id uuid, p_target_space_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not public.can_edit_collection(p_collection_id) then raise exception 'source collection not found or not editable'; end if;
  if not public.can_edit_space(p_target_space_id) then raise exception 'target space not found or not editable'; end if;
  update collections
  set space_id = p_target_space_id,
      position = (select coalesce(max(position), 0) + 1000 from collections where space_id = p_target_space_id)
  where id = p_collection_id;
end;
$$;
revoke execute on function public.move_collection(uuid, uuid) from public, anon;
grant execute on function public.move_collection(uuid, uuid) to authenticated;

create or replace function public.create_collection_share_code(p_collection_id uuid, p_expires_in_days int default 7)
returns table(code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code text;
  v_expires timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not public.can_edit_collection(p_collection_id) then raise exception 'collection not found or not accessible'; end if;
  perform pg_advisory_xact_lock(hashtext(p_collection_id::text));
  return query
    select s.code, s.expires_at from collection_share_codes s
    where s.collection_id = p_collection_id and s.revoked_at is null
      and (s.expires_at is null or s.expires_at > now());
  if found then return; end if;
  v_expires := case when p_expires_in_days is null then null else now() + make_interval(days => p_expires_in_days) end;
  for attempt in 1..20 loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    begin
      insert into collection_share_codes(code, collection_id, created_by, expires_at)
      values (v_code, p_collection_id, v_uid, v_expires);
      return query select v_code, v_expires;
      return;
    exception when unique_violation then
    end;
  end loop;
  raise exception 'failed to generate share code';
end;
$$;
revoke execute on function public.create_collection_share_code(uuid, int) from public, anon;
grant execute on function public.create_collection_share_code(uuid, int) to authenticated;

create or replace function public.import_collection_by_code(p_code text, p_target_space_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_collection_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select s.collection_id into v_collection_id from collection_share_codes s
  where s.code = p_code and s.revoked_at is null and (s.expires_at is null or s.expires_at > now());
  if v_collection_id is null then raise exception 'share code not found or expired'; end if;
  if not public.can_edit_space(p_target_space_id) then raise exception 'target space not found or not editable'; end if;
  return copy_collection_rows(v_collection_id, p_target_space_id, v_uid);
end;
$$;
revoke execute on function public.import_collection_by_code(text, uuid) from public, anon;
grant execute on function public.import_collection_by_code(text, uuid) to authenticated;
