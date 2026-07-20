-- 컬렉션 단위 비공개: is_private면 생성자(user_id)만 접근·편집. 아니면 기존 스페이스 기준.

alter table public.collections add column is_private boolean not null default false;

-- 판정 함수에 비공개 오버레이 (0010 정의를 대체)
create or replace function public.has_collection_access(p_collection_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from collections c
      where c.id = p_collection_id
        and (case when c.is_private then c.user_id = auth.uid()
                  else public.has_space_access(c.space_id) end)
    );
$$;

create or replace function public.can_edit_collection(p_collection_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from collections c
      where c.id = p_collection_id
        and (case when c.is_private then c.user_id = auth.uid()
                  else public.can_edit_space(c.space_id) end)
    );
$$;

-- collections 정책: 비공개면 생성자만 보이고/편집. (링크는 has_collection_access/can_edit_collection에
-- 위임하므로 자동 상속.)
drop policy "collections_select" on public.collections;
create policy "collections_select" on public.collections
  for select using (
    case when is_private then user_id = auth.uid()
         else public.has_space_access(space_id) end
  );

drop policy "collections_update" on public.collections;
create policy "collections_update" on public.collections
  for update using (
    case when is_private then user_id = auth.uid() else public.has_space_access(space_id) end
  ) with check (
    case when is_private then user_id = auth.uid() else public.can_edit_space(space_id) end
  );

drop policy "collections_delete" on public.collections;
create policy "collections_delete" on public.collections
  for delete using (
    case when is_private then user_id = auth.uid() else public.can_edit_space(space_id) end
  );
-- collections_insert(0011)은 그대로: 생성 시 can_edit_space + user_id=auth.uid(). 생성 후 토글로 비공개 전환.
