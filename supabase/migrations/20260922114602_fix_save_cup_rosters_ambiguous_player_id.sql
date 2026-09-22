-- Avoid PL/pgSQL variable/column name collisions when saving a player to one
-- or several teams in the same cup.
create or replace function public.save_cup_rosters_action(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  u public.app_users := public.claim_app_user();
  cid bigint := nullif(payload->>'cupId', '')::bigint;
  item jsonb;
  selected_team_id bigint;
  selected_player_id bigint;
begin
  perform public.require_admin(u);
  if cid is null or not exists(select 1 from public.cups c where c.id = cid) then
    raise exception 'Cupen finnes ikke.';
  end if;

  for item in
    select assignment.value
    from jsonb_array_elements(coalesce(payload->'assignments', '[]'::jsonb)) assignment(value)
  loop
    selected_team_id := nullif(item->>'cupTeamId', '')::bigint;
    selected_player_id := nullif(item->>'playerId', '')::bigint;

    if not exists(
      select 1
      from public.cup_teams ct
      where ct.id = selected_team_id
        and ct.cup_id = cid
    ) then
      raise exception 'Et valgt lag tilhører ikke cupen.';
    end if;

    if not exists(
      select 1
      from public.players p
      where p.id = selected_player_id
        and p.active
    ) then
      raise exception 'En valgt spiller finnes ikke eller er deaktivert.';
    end if;
  end loop;

  delete from public.cup_team_players current_assignment
  where current_assignment.cup_id = cid
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(payload->'assignments', '[]'::jsonb)) desired(item)
      where (desired.item->>'cupTeamId')::bigint = current_assignment.cup_team_id
        and (desired.item->>'playerId')::bigint = current_assignment.player_id
    );

  insert into public.cup_team_players(cup_id, cup_team_id, player_id)
  select distinct
    cid,
    (desired.item->>'cupTeamId')::bigint,
    (desired.item->>'playerId')::bigint
  from jsonb_array_elements(coalesce(payload->'assignments', '[]'::jsonb)) desired(item)
  on conflict on constraint cup_team_players_pkey do nothing;

  return '{"ok":true}'::jsonb;
end;
$function$;

revoke all on function public.save_cup_rosters_action(jsonb) from public, anon;
grant execute on function public.save_cup_rosters_action(jsonb) to authenticated;
