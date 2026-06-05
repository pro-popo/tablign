-- profiles: auth.users 확장
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 신규 가입 시 프로필 자동 생성
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- spaces
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  position double precision not null default 1000,
  created_at timestamptz not null default now()
);
create index spaces_user_id_idx on public.spaces(user_id);

-- collections
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  icon text,
  note text,
  position double precision not null default 1000,
  created_at timestamptz not null default now()
);
create index collections_space_id_idx on public.collections(space_id);
create index collections_user_id_idx on public.collections(user_id);

-- links
create table public.links (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text,
  favicon_url text,
  thumbnail_url text,
  custom_title text,
  position double precision not null default 1000,
  created_at timestamptz not null default now()
);
create index links_collection_id_idx on public.links(collection_id);
create index links_user_id_idx on public.links(user_id);

-- tags
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now()
);
create index tags_user_id_idx on public.tags(user_id);

-- collection_tags (다대다)
create table public.collection_tags (
  collection_id uuid not null references public.collections(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (collection_id, tag_id)
);
