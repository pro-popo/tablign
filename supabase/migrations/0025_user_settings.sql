-- 사용자별 설정(지금은 테마)과 배경 사진 버킷. 본인만 읽고 쓴다.
-- profiles는 같은 스페이스 멤버도 읽을 수 있어(0011) 개인 설정을 따로 둔다.
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "user_settings_all_own" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 0005의 기본 권한(default privileges)이 authenticated DML을 주지만, 명시해 둔다
grant select, insert, update, delete on public.user_settings to authenticated;
grant select, insert, update, delete on public.user_settings to service_role;

-- 배경 사진: 비공개 버킷, 본인 폴더({user_id}/...)만 읽고 쓴다
insert into storage.buckets (id, name, public)
values ('backgrounds', 'backgrounds', false)
on conflict (id) do nothing;

create policy "backgrounds_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "backgrounds_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "backgrounds_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "backgrounds_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);
