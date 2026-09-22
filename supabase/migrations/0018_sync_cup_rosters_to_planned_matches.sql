create schema if not exists app_private;
revoke all on schema app_private from public;

create or replace function app_private.sync_removed_cup_player_from_planned_matches()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.cup_team_players ctp
    where ctp.cup_id = old.cup_id
      and ctp.cup_team_id = old.cup_team_id
      and ctp.player_id = old.player_id
  ) then
    delete from public.match_players mp
    using public.matches m
    where mp.match_id = m.id
      and mp.player_id = old.player_id
      and m.cup_id = old.cup_id
      and m.cup_team_id = old.cup_team_id
      and m.status = 'planned';
  end if;

  return null;
end;
$function$;

revoke all on function app_private.sync_removed_cup_player_from_planned_matches() from public, anon, authenticated;

drop trigger if exists sync_removed_cup_player_from_planned_matches on public.cup_team_players;
create constraint trigger sync_removed_cup_player_from_planned_matches
after delete on public.cup_team_players
deferrable initially deferred
for each row
execute function app_private.sync_removed_cup_player_from_planned_matches();
