-- 공유 코드 조회·가져오기 (공유 2단계)

-- 내부 전용 딥카피 헬퍼: 권한 검증 없음. copy_collection과 import_collection_by_code가 공유한다.
-- authenticated에게도 execute를 회수해 오직 definer 함수 내부에서만 호출된다.
create function public.copy_collection_rows(
  p_collection_id uuid,
  p_target_space_id uuid,
  p_owner uuid
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_new_id uuid;
begin
  insert into collections (space_id, user_id, title, icon, note, position)
  select p_target_space_id, p_owner, title, icon, note,
         (select coalesce(max(position), 0) + 1000 from collections where space_id = p_target_space_id)
  from collections where id = p_collection_id
  returning id into v_new_id;

  insert into links (collection_id, user_id, url, title, favicon_url, thumbnail_url, custom_title, note, position)
  select v_new_id, p_owner, url, title, favicon_url, thumbnail_url, custom_title, note, position
  from links where collection_id = p_collection_id;

  return v_new_id;
end;
$$;

revoke execute on function public.copy_collection_rows(uuid, uuid, uuid) from public, anon, authenticated;

-- copy_collection: 검증은 유지하고 복사 본문만 헬퍼에 위임 (동작·시그니처 불변)
create or replace function public.copy_collection(p_collection_id uuid, p_target_space_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from collections c join spaces s on s.id = c.space_id
    where c.id = p_collection_id and s.user_id = v_uid
  ) then
    raise exception 'source collection not found or not accessible';
  end if;
  if not exists (
    select 1 from spaces where id = p_target_space_id and user_id = v_uid
  ) then
    raise exception 'target space not found or not editable';
  end if;
  return copy_collection_rows(p_collection_id, p_target_space_id, v_uid);
end;
$$;

-- 코드 미리보기: 활성 코드면 컬렉션 이름·아이콘·링크 수·공유한 사람 이름을 돌려준다.
create function public.get_share_code_info(p_code text)
returns table(title text, icon text, link_count bigint, shared_by text)
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  return query
    select c.title, c.icon,
           (select count(*) from links l where l.collection_id = c.id),
           p.display_name
    from collection_share_codes s
    join collections c on c.id = s.collection_id
    left join profiles p on p.id = s.created_by
    where s.code = p_code
      and s.revoked_at is null
      and (s.expires_at is null or s.expires_at > now());
  if not found then
    raise exception 'share code not found or expired';
  end if;
end;
$$;

revoke execute on function public.get_share_code_info(text) from public, anon;
grant execute on function public.get_share_code_info(text) to authenticated;

-- 코드로 가져오기: 활성 코드 + 대상 스페이스 소유 검증 후 스냅샷 복사.
create function public.import_collection_by_code(p_code text, p_target_space_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_collection_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select s.collection_id into v_collection_id
  from collection_share_codes s
  where s.code = p_code
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > now());
  if v_collection_id is null then
    raise exception 'share code not found or expired';
  end if;

  if not exists (
    select 1 from spaces where id = p_target_space_id and user_id = v_uid
  ) then
    raise exception 'target space not found or not editable';
  end if;

  return copy_collection_rows(v_collection_id, p_target_space_id, v_uid);
end;
$$;

revoke execute on function public.import_collection_by_code(text, uuid) from public, anon;
grant execute on function public.import_collection_by_code(text, uuid) to authenticated;
