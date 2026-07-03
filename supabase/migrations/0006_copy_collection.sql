-- 컬렉션 딥카피 RPC (공유 1단계: 내 스페이스 간 복사)
-- security definer: 이후 공유 코드(2단계)·공유 스페이스(3단계)에서 재사용할 수 있도록
-- 권한 검증을 함수 내부에서 수행한다.
create function public.copy_collection(p_collection_id uuid, p_target_space_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new_id uuid;
  v_next_pos double precision;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- 1단계(개인 전용): 원본 컬렉션의 스페이스와 대상 스페이스 모두 호출자 소유여야 한다.
  -- 3단계(공유 스페이스)에서 has_space_access/can_edit_space 헬퍼 기반으로 교체 예정.
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

  -- 대상 스페이스 맨 아래 position (기존 GAP=1000 규칙)
  select coalesce(max(position), 0) + 1000 into v_next_pos
  from collections where space_id = p_target_space_id;

  insert into collections (space_id, user_id, title, icon, note, position)
  select p_target_space_id, v_uid, title, icon, note, v_next_pos
  from collections where id = p_collection_id
  returning id into v_new_id;

  -- 링크 딥카피: position 유지, user_id는 호출자. 태그는 복사하지 않는다(설계 결정).
  insert into links (collection_id, user_id, url, title, favicon_url, thumbnail_url, custom_title, note, position)
  select v_new_id, v_uid, url, title, favicon_url, thumbnail_url, custom_title, note, position
  from links where collection_id = p_collection_id;

  return v_new_id;
end;
$$;

revoke execute on function public.copy_collection(uuid, uuid) from public, anon;
grant execute on function public.copy_collection(uuid, uuid) to authenticated;
