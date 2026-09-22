-- A player can belong to more than one team in the same cup, for example as an
-- extra substitute. Cup roster changes are propagated to every planned match.
alter table public.cup_team_players
  drop constraint if exists cup_team_players_pkey;

alter table public.cup_team_players
  add constraint cup_team_players_pkey primary key (cup_id, cup_team_id, player_id);

drop trigger if exists sync_removed_cup_player_from_planned_matches on public.cup_team_players;
drop function if exists app_private.sync_removed_cup_player_from_planned_matches();

create or replace function app_private.sync_cup_player_to_planned_matches()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.match_players(match_id, player_id, starter, goalkeeper, captain, position)
    select m.id, new.player_id, false, false, false, 'bench'
    from public.matches m
    where m.cup_id = new.cup_id
      and m.cup_team_id = new.cup_team_id
      and m.status = 'planned'
    on conflict (match_id, player_id) do nothing;
  elsif tg_op = 'DELETE' and not exists (
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

revoke all on function app_private.sync_cup_player_to_planned_matches() from public, anon, authenticated;

create constraint trigger sync_cup_player_to_planned_matches
after insert or delete on public.cup_team_players
deferrable initially deferred
for each row
execute function app_private.sync_cup_player_to_planned_matches();

-- Save only the actual differences. This avoids treating an unchanged player
-- as newly added and preserves deliberate per-match selections.
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
  team_id bigint;
  player_id bigint;
begin
  perform public.require_admin(u);
  if cid is null or not exists(select 1 from public.cups where id = cid) then
    raise exception 'Cupen finnes ikke.';
  end if;

  for item in select value from jsonb_array_elements(coalesce(payload->'assignments', '[]'::jsonb)) loop
    team_id := nullif(item->>'cupTeamId', '')::bigint;
    player_id := nullif(item->>'playerId', '')::bigint;
    if not exists(select 1 from public.cup_teams where id = team_id and cup_id = cid) then
      raise exception 'Et valgt lag tilhører ikke cupen.';
    end if;
    if not exists(select 1 from public.players where id = player_id and active) then
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
  select distinct cid, (desired.item->>'cupTeamId')::bigint, (desired.item->>'playerId')::bigint
  from jsonb_array_elements(coalesce(payload->'assignments', '[]'::jsonb)) desired(item)
  on conflict (cup_id, cup_team_id, player_id) do nothing;

  return '{"ok":true}'::jsonb;
end;
$function$;

revoke all on function public.save_cup_rosters_action(jsonb) from public, anon;
grant execute on function public.save_cup_rosters_action(jsonb) to authenticated;

-- Remove any stale players left in planned cup matches from before automatic
-- synchronization was introduced.
delete from public.match_players mp
using public.matches m
where mp.match_id = m.id
  and m.status = 'planned'
  and m.cup_id is not null
  and m.cup_team_id is not null
  and not exists (
    select 1
    from public.cup_team_players ctp
    where ctp.cup_id = m.cup_id
      and ctp.cup_team_id = m.cup_team_id
      and ctp.player_id = mp.player_id
  );

-- Include the roster in the lightweight snapshot used by an open match.
create or replace function public.live_match_snapshot(match_id_input bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  u public.app_users := public.claim_app_user();
  result jsonb;
begin
  if not exists (select 1 from public.matches where id = match_id_input) then
    raise exception 'Kampen finnes ikke.';
  end if;

  select jsonb_build_object(
    'match', jsonb_build_object(
      'id', m.id, 'date', m.date, 'startTime', m.start_time,
      'opponent', m.opponent, 'team', m.team, 'homeAway', m.home_away,
      'competition', m.competition, 'matchType', m.match_type,
      'cupName', m.cup_name, 'venue', m.venue,
      'registrarName', (select au.name from public.match_registrars mr join public.app_users au on au.id=mr.user_id where mr.match_id=m.id order by au.name limit 1),
      'ourScore', m.our_score, 'opponentScore', m.opponent_score,
      'periodCount', m.period_count, 'periodMinutes', m.period_minutes,
      'matchPhase', m.match_phase, 'currentPeriod', m.current_period,
      'periodElapsedSeconds', m.period_elapsed_seconds,
      'clockStartedAt', m.clock_started_at, 'elapsedSeconds', m.elapsed_seconds,
      'clockRunning', m.clock_running,
      'notes', case when u.role='admin' or exists(select 1 from public.match_registrars mr where mr.match_id=m.id and mr.user_id=u.id) then m.notes else '' end,
      'status', m.status, 'completedAt', m.completed_at, 'createdAt', m.created_at
    ),
    'matchPlayers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'matchId', mp.match_id, 'playerId', mp.player_id, 'starter', mp.starter,
        'goalkeeper', mp.goalkeeper, 'captain', mp.captain, 'position', mp.position
      ) order by mp.player_id), '[]'::jsonb)
      from public.match_players mp where mp.match_id=m.id
    ),
    'matchEvents', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'matchId', e.match_id, 'playerId', e.player_id,
        'side', e.side, 'type', e.type, 'matchSecond', e.match_second,
        'period', e.period, 'periodSecond', e.period_second, 'createdAt', e.created_at
      ) order by e.id desc), '[]'::jsonb)
      from public.match_events e where e.match_id=m.id
    ),
    'matchSubstitutions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'matchId', s.match_id, 'playerInId', s.player_in_id,
        'playerOutId', s.player_out_id, 'position', s.position,
        'matchSecond', s.match_second, 'period', s.period,
        'periodSecond', s.period_second, 'createdAt', s.created_at
      ) order by s.id), '[]'::jsonb)
      from public.match_substitutions s where s.match_id=m.id
    )
  ) into result
  from public.matches m where m.id=match_id_input;

  return result;
end;
$function$;

revoke all on function public.live_match_snapshot(bigint) from public, anon;
grant execute on function public.live_match_snapshot(bigint) to authenticated;
