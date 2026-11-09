create or replace function public.require_editable_match(u public.app_users, target_match bigint)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $function$
declare
  m public.matches;
begin
  if u.role <> 'admin'
     and not (
       u.role in ('parent', 'match_registrar')
       and exists (
         select 1
         from public.match_registrars
         where match_id = target_match
           and user_id = u.id
       )
     ) then
    raise exception 'Du har ikke tilgang til å registrere denne kampen.'
      using errcode = '42501';
  end if;

  select *
  into m
  from public.matches
  where id = target_match
    and team_slug = public.current_team_slug();

  if m.id is null then
    raise exception 'Kampen finnes ikke.';
  end if;

  if m.status in ('completed', 'cancelled') then
    raise exception 'Kampen er låst. En administrator må åpne den igjen.';
  end if;

  return m;
end;
$function$;
