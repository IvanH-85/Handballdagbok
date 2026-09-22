create or replace function public.reset_match_action(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  u public.app_users := public.claim_app_user();
  mid bigint := nullif(payload->>'matchId', '')::bigint;
begin
  perform public.require_admin(u);

  if mid is null or not exists(select 1 from public.matches where id = mid) then
    raise exception 'Kampen finnes ikke.';
  end if;

  delete from public.match_comments where match_id = mid;
  delete from public.match_substitutions where match_id = mid;
  delete from public.match_events where match_id = mid;

  update public.matches
  set our_score = null,
      opponent_score = null,
      current_period = 0,
      match_phase = 'pre_match',
      period_elapsed_seconds = 0,
      elapsed_seconds = 0,
      clock_started_at = null,
      clock_running = false,
      notes = '',
      status = 'planned',
      completed_at = null
  where id = mid;

  return '{"ok":true}'::jsonb;
end;
$function$;

revoke all on function public.reset_match_action(jsonb) from public, anon;
grant execute on function public.reset_match_action(jsonb) to authenticated;
