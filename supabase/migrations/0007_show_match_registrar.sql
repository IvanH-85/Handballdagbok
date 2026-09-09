-- Expose only the selected registrar's display name with each match.
-- Contact details and the rest of the user list remain hidden from parents.
do $migration$
declare
  old_definition text;
  new_definition text;
  old_fragment text := '''venue'',venue,''ourScore'',our_score';
  new_fragment text := '''venue'',venue,''registrarName'',(select au.name from public.match_registrars mr join public.app_users au on au.id=mr.user_id where mr.match_id=matches.id order by au.name limit 1),''ourScore'',our_score';
begin
  select pg_get_functiondef(p.oid)
    into old_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'season_snapshot'
    and pg_get_function_identity_arguments(p.oid) = '';

  if old_definition is null then
    raise exception 'Fant ikke season_snapshot().';
  end if;

  if position(''registrarName'' in old_definition) = 0 then
    new_definition := replace(old_definition, old_fragment, new_fragment);
    if new_definition = old_definition then
      raise exception 'Kunne ikke legge kampregistratornavn til season_snapshot().';
    end if;

    execute new_definition;
  end if;
end
$migration$;
