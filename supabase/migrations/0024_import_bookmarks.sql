-- 북마크 가져오기: 스페이스·컬렉션·링크를 한 트랜잭션에 삽입한다.
-- 클라이언트에서 반복 insert하면 중간 실패 시 반쪽짜리 보드가 남는다.
-- security definer + can_edit_org 검증 (copy_collection과 같은 방식).
create function public.import_bookmarks(p_org_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_base_pos double precision;
  v_space_ids uuid[] := '{}';
  v_space_id uuid;
  v_col_id uuid;
  v_links int := 0;
  v_space record;
  v_col record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- owner 또는 admin만. 팀 조직의 일반 멤버는 spaces_insert 정책과 동일하게 막힌다.
  if not public.can_edit_org(p_org_id) then
    raise exception 'org not found or not editable';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'array' or jsonb_array_length(p_payload) = 0 then
    raise exception 'nothing to import';
  end if;

  -- 새 스페이스는 이 조직 기존 스페이스 뒤에 붙는다 (GAP=1000 규칙)
  select coalesce(max(position), 0) into v_base_pos from spaces where org_id = p_org_id;

  for v_space in
    select value, ordinality from jsonb_array_elements(p_payload) with ordinality as t(value, ordinality)
  loop
    insert into spaces (user_id, org_id, name, position)
    values (v_uid, p_org_id, v_space.value->>'name', v_base_pos + v_space.ordinality * 1000)
    returning id into v_space_id;
    v_space_ids := v_space_ids || v_space_id;

    for v_col in
      select value, ordinality
      from jsonb_array_elements(coalesce(v_space.value->'collections', '[]'::jsonb))
        with ordinality as t(value, ordinality)
    loop
      insert into collections (space_id, user_id, title, position)
      values (v_space_id, v_uid, v_col.value->>'title', v_col.ordinality * 1000)
      returning id into v_col_id;

      insert into links (collection_id, user_id, url, title, favicon_url, position)
      select v_col_id, v_uid, l.value->>'url', l.value->>'title', l.value->>'favicon_url',
             l.ordinality * 1000
      from jsonb_array_elements(coalesce(v_col.value->'links', '[]'::jsonb))
        with ordinality as l(value, ordinality);

      v_links := v_links + coalesce(jsonb_array_length(v_col.value->'links'), 0);
    end loop;
  end loop;

  return jsonb_build_object(
    'space_ids', to_jsonb(v_space_ids),
    'first_space_id', v_space_ids[1],
    'links', v_links
  );
end;
$$;

revoke execute on function public.import_bookmarks(uuid, jsonb) from public, anon;
grant execute on function public.import_bookmarks(uuid, jsonb) to authenticated;
