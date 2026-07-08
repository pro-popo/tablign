-- 컬렉션 이동 RPC (공유 1단계)
-- copy_collection과 대칭: 원본·대상 소유권을 서버에서 검증한다.
-- 현재 RLS(user_id 단독)는 대상 스페이스 소유권을 검사하지 못하므로 RPC로 강제한다.
-- 3단계(공유 스페이스)에서 has_space_access/can_edit_space 헬퍼 기반으로 교체 예정.
create function public.move_collection(p_collection_id uuid, p_target_space_id uuid)
returns void
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

  -- 대상 스페이스 맨 아래로: max(position)+1000을 update 문 안에서 계산(경쟁 창 없음)
  update collections
  set space_id = p_target_space_id,
      position = (select coalesce(max(position), 0) + 1000 from collections where space_id = p_target_space_id)
  where id = p_collection_id;
end;
$$;

revoke execute on function public.move_collection(uuid, uuid) from public, anon;
grant execute on function public.move_collection(uuid, uuid) to authenticated;
