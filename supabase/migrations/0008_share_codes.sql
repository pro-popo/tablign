-- 컬렉션 공유 코드 (공유 2단계)
-- 코드는 비밀값: 테이블 직접 조회는 발급자만, 코드로 열람·가져오기는 RPC 내부에서만 이뤄진다.
create table public.collection_share_codes (
  code          text primary key,
  collection_id uuid not null references public.collections(id) on delete cascade,
  created_by    uuid not null references auth.users(id) on delete cascade,
  expires_at    timestamptz,             -- null = 무기한
  revoked_at    timestamptz,             -- 발급자가 회수
  created_at    timestamptz not null default now()
);
create index collection_share_codes_collection_id_idx on public.collection_share_codes(collection_id);

alter table public.collection_share_codes enable row level security;

-- select/update(회수)는 발급자만. insert/delete 정책 없음 → 직접 불가(발급은 RPC 경유).
create policy "share_codes_select_own" on public.collection_share_codes
  for select using (auth.uid() = created_by);
create policy "share_codes_update_own" on public.collection_share_codes
  for update using (auth.uid() = created_by) with check (auth.uid() = created_by);

-- 발급 RPC: 활성 코드가 있으면 반환, 없으면 생성. p_expires_in_days null = 무기한.
create function public.create_collection_share_code(
  p_collection_id uuid,
  p_expires_in_days int default 7
)
returns table(code text, expires_at timestamptz)
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';  -- 0,1,I,L,O 제외
  v_code text;
  v_expires timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- 2단계(개인 전용): 컬렉션의 스페이스 소유자만 발급. 3단계에서 can_edit_space 기반으로 교체 예정.
  if not exists (
    select 1 from collections c join spaces s on s.id = c.space_id
    where c.id = p_collection_id and s.user_id = v_uid
  ) then
    raise exception 'collection not found or not accessible';
  end if;

  -- 같은 컬렉션의 동시 발급을 직렬화해 활성 코드 1개 불변식을 지킨다
  perform pg_advisory_xact_lock(hashtext(p_collection_id::text));

  -- 활성 코드(미회수·미만료)가 있으면 그대로 반환 → 컬렉션당 활성 코드 1개 유지
  return query
    select s.code, s.expires_at from collection_share_codes s
    where s.collection_id = p_collection_id
      and s.revoked_at is null
      and (s.expires_at is null or s.expires_at > now());
  if found then return; end if;

  v_expires := case when p_expires_in_days is null then null
                    else now() + make_interval(days => p_expires_in_days) end;

  -- 8자 랜덤 코드 생성. pk 충돌 시 재시도.
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
      -- 충돌 확률은 낮지만 재시도
    end;
  end loop;
  raise exception 'failed to generate share code';
end;
$$;

-- 발급자 update는 회수(revoked_at)만 허용 — 코드·컬렉션 바꿔치기 방지
create function public.guard_share_code_update()
returns trigger
language plpgsql
as $$
begin
  if new.code <> old.code
     or new.collection_id <> old.collection_id
     or new.created_by <> old.created_by
     or new.created_at <> old.created_at
     or new.expires_at is distinct from old.expires_at then
    raise exception 'only revoked_at can be updated';
  end if;
  return new;
end;
$$;

create trigger share_codes_guard_update
  before update on public.collection_share_codes
  for each row execute function public.guard_share_code_update();

revoke execute on function public.create_collection_share_code(uuid, int) from public, anon;
grant execute on function public.create_collection_share_code(uuid, int) to authenticated;
