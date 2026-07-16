-- organizations 소유권·개인여부 불변 가드 (MVP: 소유권 양도 없음)
create function public.guard_org_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'owner_id cannot be changed';
  end if;
  if new.is_personal <> old.is_personal then
    raise exception 'is_personal cannot be changed';
  end if;
  return new;
end;
$$;
create trigger organizations_update_guard
  before update on public.organizations
  for each row execute function public.guard_org_update();
