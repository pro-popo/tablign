-- spaces.org_id 추가 → 개인 조직 백필 → not null 승격

alter table public.spaces add column org_id uuid references public.organizations(id) on delete cascade;

-- 1) 모든 profiles에 개인 조직 생성(없으면)
insert into public.organizations (name, owner_id, is_personal)
select '개인', p.id, true from public.profiles p
where not exists (
  select 1 from public.organizations o where o.owner_id = p.id and o.is_personal
);

-- 2) 기존 스페이스를 소유자의 개인 조직에 소속
update public.spaces s
set org_id = o.id
from public.organizations o
where o.owner_id = s.user_id and o.is_personal and s.org_id is null;

-- 3) not null 승격
alter table public.spaces alter column org_id set not null;
create index spaces_org_id_idx on public.spaces(org_id);

-- 4) org_id 미지정 insert는 소유자의 개인 조직으로 자동 채움
--    (기존 createSpace 호출부·테스트가 org_id 없이 insert해도 동작하게)
create function public.set_default_space_org() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is null then
    select id into new.org_id from organizations where owner_id = new.user_id and is_personal;
  end if;
  return new;
end;
$$;
create trigger spaces_default_org
  before insert on public.spaces
  for each row execute function public.set_default_space_org();

-- 5) 신규 가입 시 profiles와 함께 개인 조직도 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  insert into public.organizations (name, owner_id, is_personal)
  values ('개인', new.id, true);
  return new;
end;
$$;
