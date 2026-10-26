do $migration$
declare
  function_definition text;
  old_fragment constant text := $q$elsif tg_table_name='match_events' and new.player_id is not null then
      select team_slug into ref_slug from public.players where id=new.player_id;
      if ref_slug is distinct from active_slug then raise exception 'Spilleren tilhører et annet lag.' using errcode='42501'; end if;$q$;
  new_fragment constant text := $q$elsif tg_table_name='match_events' then
      if new.player_id is not null then
        select team_slug into ref_slug from public.players where id=new.player_id;
        if ref_slug is distinct from active_slug then raise exception 'Spilleren tilhører et annet lag.' using errcode='42501'; end if;
      end if;$q$;
begin
  select pg_get_functiondef('public.guard_team_data()'::regprocedure)
  into function_definition;

  if position(old_fragment in function_definition) = 0 then
    raise exception 'Expected match_events guard fragment was not found; refusing to change guard_team_data.';
  end if;

  execute replace(function_definition, old_fragment, new_fragment);
end
$migration$;
