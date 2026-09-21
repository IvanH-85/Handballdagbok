begin;

create or replace function public.swap_match_players_action(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  u public.app_users := public.claim_app_user();
  mid bigint := (payload->>'matchId')::bigint;
  outgoing bigint := (payload->>'playerOutId')::bigint;
  incoming bigint := (payload->>'playerInId')::bigint;
  m public.matches;
  item jsonb;
  current_positions jsonb := '{}'::jsonb;
  outgoing_position text;
  incoming_position text;
  period_limit integer;
  rid bigint;
begin
  m := public.require_editable_match(u,mid);
  if incoming=outgoing
    or not exists(select 1 from public.match_players where match_id=mid and player_id=incoming)
    or not exists(select 1 from public.match_players where match_id=mid and player_id=outgoing) then
    raise exception 'Begge spillerne må være med i laguttaket.';
  end if;

  select coalesce(jsonb_object_agg(player_id::text,position),'{}') into current_positions
    from public.match_players where match_id=mid;
  for item in select jsonb_build_object(
      'in',player_in_id,'out',player_out_id,'position',position,
      'swap',swap,'previous',player_in_previous_position)
    from public.match_substitutions where match_id=mid order by id loop
    if coalesce((item->>'swap')::boolean,false) then
      current_positions := jsonb_set(current_positions,array[item->>'out'],to_jsonb(item->>'previous'));
    else
      current_positions := jsonb_set(current_positions,array[item->>'out'],to_jsonb('bench'::text));
    end if;
    current_positions := jsonb_set(current_positions,array[item->>'in'],to_jsonb(item->>'position'));
  end loop;

  outgoing_position := current_positions->>outgoing::text;
  incoming_position := current_positions->>incoming::text;
  if outgoing_position not in ('goalkeeper','right_wing','right_back','center','left_back','left_wing')
    or incoming_position not in ('goalkeeper','right_wing','right_back','center','left_back','left_wing') then
    raise exception 'Begge spillerne må være på banen for å bytte posisjon.';
  end if;
  if exists(select 1 from public.match_events
    where match_id=mid and player_id in (incoming,outgoing) and side='ours' and type='red') then
    raise exception 'En spiller med rødt kort kan ikke bytte posisjon.';
  end if;

  period_limit := greatest(60,m.period_minutes*60);
  insert into public.match_substitutions(
    match_id,player_in_id,player_out_id,position,swap,player_in_previous_position,
    match_second,period,period_second)
  values(
    mid,incoming,outgoing,outgoing_position,true,incoming_position,
    greatest(0,coalesce((payload->>'matchSecond')::integer,0)),
    case when m.current_period=2 then 2 else 1 end,
    least(period_limit,greatest(0,coalesce((payload->>'periodSecond')::integer,
      coalesce((payload->>'matchSecond')::integer,0)))))
  returning id into rid;

  return jsonb_build_object('substitution',jsonb_build_object('id',rid));
end $$;

revoke all on function public.swap_match_players_action(jsonb) from public,anon;
grant execute on function public.swap_match_players_action(jsonb) to authenticated;

commit;
