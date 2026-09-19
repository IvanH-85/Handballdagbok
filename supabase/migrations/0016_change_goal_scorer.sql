begin;

create or replace function public.change_goal_scorer_action(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  u public.app_users := public.claim_app_user();
  eid bigint := (payload->>'eventId')::bigint;
  new_player_id bigint := (payload->>'playerId')::bigint;
  mid bigint;
begin
  select match_id into mid
  from public.match_events
  where id=eid and side='ours' and type in ('goal_open','goal_penalty');
  if mid is null then raise exception 'Målet finnes ikke eller tilhører motstanderlaget.'; end if;
  perform public.require_editable_match(u,mid);
  if not exists(select 1 from public.match_players where match_id=mid and player_id=new_player_id) then
    raise exception 'Spilleren må være med i laguttaket.';
  end if;
  update public.match_events set player_id=new_player_id where id=eid;
  return '{"ok":true}'::jsonb;
end $$;

revoke all on function public.change_goal_scorer_action(jsonb) from public,anon;
grant execute on function public.change_goal_scorer_action(jsonb) to authenticated;

commit;
