begin;

-- A small authenticated snapshot for the match currently open on a device.
-- This avoids downloading the full season every few seconds during live play.
create or replace function public.live_match_snapshot(match_id_input bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.app_users := public.claim_app_user();
  result jsonb;
begin
  if not exists (select 1 from public.matches where id = match_id_input) then
    raise exception 'Kampen finnes ikke.';
  end if;

  select jsonb_build_object(
    'match', jsonb_build_object(
      'id', m.id,
      'date', m.date,
      'startTime', m.start_time,
      'opponent', m.opponent,
      'team', m.team,
      'homeAway', m.home_away,
      'competition', m.competition,
      'matchType', m.match_type,
      'cupName', m.cup_name,
      'venue', m.venue,
      'registrarName', (
        select au.name
        from public.match_registrars mr
        join public.app_users au on au.id = mr.user_id
        where mr.match_id = m.id
        order by au.name
        limit 1
      ),
      'ourScore', m.our_score,
      'opponentScore', m.opponent_score,
      'periodCount', m.period_count,
      'periodMinutes', m.period_minutes,
      'matchPhase', m.match_phase,
      'currentPeriod', m.current_period,
      'periodElapsedSeconds', m.period_elapsed_seconds,
      'clockStartedAt', m.clock_started_at,
      'elapsedSeconds', m.elapsed_seconds,
      'clockRunning', m.clock_running,
      'notes', case when u.role = 'admin' or exists (
        select 1 from public.match_registrars mr
        where mr.match_id = m.id and mr.user_id = u.id
      ) then m.notes else '' end,
      'status', m.status,
      'completedAt', m.completed_at,
      'createdAt', m.created_at
    ),
    'matchEvents', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'matchId', e.match_id,
        'playerId', e.player_id,
        'side', e.side,
        'type', e.type,
        'matchSecond', e.match_second,
        'period', e.period,
        'periodSecond', e.period_second,
        'createdAt', e.created_at
      ) order by e.id desc), '[]'::jsonb)
      from public.match_events e
      where e.match_id = m.id
    ),
    'matchSubstitutions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'matchId', s.match_id,
        'playerInId', s.player_in_id,
        'playerOutId', s.player_out_id,
        'position', s.position,
        'matchSecond', s.match_second,
        'period', s.period,
        'periodSecond', s.period_second,
        'createdAt', s.created_at
      ) order by s.id), '[]'::jsonb)
      from public.match_substitutions s
      where s.match_id = m.id
    )
  ) into result
  from public.matches m
  where m.id = match_id_input;

  return result;
end;
$$;

revoke all on function public.live_match_snapshot(bigint) from public, anon;
grant execute on function public.live_match_snapshot(bigint) to authenticated;

commit;
