-- 대상 테이블을 realtime 퍼블리케이션에 추가 (이미 있으면 무시)
alter publication supabase_realtime add table public.spaces;
alter publication supabase_realtime add table public.collections;
alter publication supabase_realtime add table public.links;
alter publication supabase_realtime add table public.collection_tags;
