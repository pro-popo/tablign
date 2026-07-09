-- 기존 개인 전용 정책을 멤버십 기반으로 개편 (select=접근, write=편집 분리)

-- spaces: 접근자는 보고, 쓰기(생성/수정/삭제)는 오너만
-- NOTE: spaces_select는 has_space_access(id) 대신 인라인 SQL 사용 —
-- security definer 함수는 INSERT RETURNING 시 동일 문장에서 삽입 중인 행을
-- 조회하지 못해 "new row violates RLS" 오류가 발생하기 때문.
drop policy "spaces_all_own" on public.spaces;
create policy "spaces_select" on public.spaces
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.space_members where space_id = spaces.id and user_id = auth.uid())
  );
create policy "spaces_insert" on public.spaces
  for insert with check (auth.uid() = user_id);
create policy "spaces_update" on public.spaces
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "spaces_delete" on public.spaces
  for delete using (auth.uid() = user_id);

-- collections: 접근자는 보고, editor 이상은 편집. insert는 본인 명의로만.
-- NOTE: collections_update는 접근자에게 행이 보이되(USING=has_space_access) 쓰기만
-- editor 이상으로 제한(WITH CHECK=can_edit_space)해야 뷰어가 시도할 때 RLS 위반 오류가 반환된다.
-- USING=can_edit_space 만 쓰면 뷰어에게 행이 보이지 않아 조용히 0행 — 오류 없음.
drop policy "collections_all_own" on public.collections;
create policy "collections_select" on public.collections
  for select using (public.has_space_access(space_id));
create policy "collections_insert" on public.collections
  for insert with check (public.can_edit_space(space_id) and auth.uid() = user_id);
create policy "collections_update" on public.collections
  for update using (public.has_space_access(space_id)) with check (public.can_edit_space(space_id));
create policy "collections_delete" on public.collections
  for delete using (public.can_edit_space(space_id));

-- links: 소속 컬렉션의 스페이스 기준
-- NOTE: links_update 도 같은 이유로 USING=has_collection_access, WITH CHECK=can_edit_collection 분리.
drop policy "links_all_own" on public.links;
create policy "links_select" on public.links
  for select using (public.has_collection_access(collection_id));
create policy "links_insert" on public.links
  for insert with check (public.can_edit_collection(collection_id) and auth.uid() = user_id);
create policy "links_update" on public.links
  for update using (public.has_collection_access(collection_id)) with check (public.can_edit_collection(collection_id));
create policy "links_delete" on public.links
  for delete using (public.can_edit_collection(collection_id));

-- collection_tags: 태그는 끝까지 개인 소유 — 태그 소유자 기준으로 변경
drop policy "collection_tags_all_own" on public.collection_tags;
create policy "collection_tags_all_own" on public.collection_tags
  for all using (
    exists (select 1 from public.tags t where t.id = collection_tags.tag_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.tags t where t.id = collection_tags.tag_id and t.user_id = auth.uid())
  );

-- profiles: 본인 + 같은 스페이스를 공유하는 멤버끼리 열람 가능
drop policy "profiles_select_own" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.uid() = id or public.shares_space_with(id));
-- profiles_update_own(본인만 수정)은 그대로 유지

-- service_role 접근 권한: 테스트 seeding 및 관리 목적
-- (0005_grants.sql 은 authenticated 에만 부여하므로 service_role 에 별도 추가)
grant select, insert, update, delete on public.spaces to service_role;
grant select, insert, update, delete on public.collections to service_role;
grant select, insert, update, delete on public.links to service_role;
grant select, insert, update, delete on public.tags to service_role;
grant select, insert, update, delete on public.collection_tags to service_role;
grant select, insert, update, delete on public.profiles to service_role;
