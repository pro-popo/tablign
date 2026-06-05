-- 모든 테이블 RLS 활성화
alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.collections enable row level security;
alter table public.links enable row level security;
alter table public.tags enable row level security;
alter table public.collection_tags enable row level security;

-- profiles: 본인 행만
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- spaces
create policy "spaces_all_own" on public.spaces
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- collections
create policy "collections_all_own" on public.collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- links
create policy "links_all_own" on public.links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- tags
create policy "tags_all_own" on public.tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- collection_tags: 연결된 컬렉션의 소유자만
create policy "collection_tags_all_own" on public.collection_tags
  for all using (
    exists (
      select 1 from public.collections c
      where c.id = collection_tags.collection_id and c.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_tags.collection_id and c.user_id = auth.uid()
    )
  );
