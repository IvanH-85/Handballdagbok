alter table public.match_events
  add column if not exists source_event_id bigint references public.match_events(id) on delete cascade;

create unique index if not exists match_events_source_event_unique_idx
  on public.match_events(source_event_id)
  where source_event_id is not null;

create or replace function app_private.match_goalkeeper_at(
  match_id_input bigint,
  match_second_input integer
)
returns bigint
language plpgsql
security invoker
stable
set search_path to ''
as $function$
declare
  positions jsonb;
  item jsonb;
  goalkeeper_key text;
begin
  select coalesce(jsonb_object_agg(mp.player_id::text,mp.position),'{}'::jsonb)
  into positions
  from public.match_players mp
  where mp.match_id=match_id_input;

  for item in
    select jsonb_build_object(
      'in',s.player_in_id,
      'out',s.player_out_id,
      'position',s.position,
      'swap',s.swap,
      'previous',s.player_in_previous_position
    )
    from public.match_substitutions s
    where s.match_id=match_id_input
      and s.match_second<=greatest(0,coalesce(match_second_input,0))
    order by s.match_second,s.id
  loop
    if coalesce((item->>'swap')::boolean,false) then
      positions:=jsonb_set(positions,array[item->>'out'],to_jsonb(item->>'previous'));
    else
      positions:=jsonb_set(positions,array[item->>'out'],to_jsonb('bench'::text));
    end if;
    positions:=jsonb_set(positions,array[item->>'in'],to_jsonb(item->>'position'));
  end loop;

  select key into goalkeeper_key
  from jsonb_each_text(positions)
  where value='goalkeeper'
  limit 1;

  return nullif(goalkeeper_key,'')::bigint;
end;
$function$;

create or replace function app_private.add_penalty_save_for_miss()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  goalkeeper_id bigint;
begin
  if new.side='opponent' and new.type='penalty_miss' then
    goalkeeper_id:=app_private.match_goalkeeper_at(new.match_id,new.match_second);
    if goalkeeper_id is not null then
      insert into public.match_events(
        match_id,player_id,side,type,match_second,period,period_second,
        annulled,annulled_at,annulled_by,source_event_id
      )
      values(
        new.match_id,goalkeeper_id,'ours','save_penalty',new.match_second,new.period,new.period_second,
        new.annulled,new.annulled_at,new.annulled_by,new.id
      )
      on conflict (source_event_id) where source_event_id is not null do nothing;
    end if;
  end if;
  return new;
end;
$function$;

create or replace function app_private.prevent_orphaned_penalty_save()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  if old.source_event_id is not null
    and exists(select 1 from public.match_events where id=old.source_event_id) then
    raise exception 'Slett straffebommen for å fjerne den automatiske strafferedningen.';
  end if;
  return old;
end;
$function$;

drop trigger if exists add_penalty_save_for_miss_trigger on public.match_events;
create trigger add_penalty_save_for_miss_trigger
after insert on public.match_events
for each row
execute function app_private.add_penalty_save_for_miss();

drop trigger if exists prevent_orphaned_penalty_save_trigger on public.match_events;
create trigger prevent_orphaned_penalty_save_trigger
before delete on public.match_events
for each row
execute function app_private.prevent_orphaned_penalty_save();

insert into public.match_events(
  match_id,player_id,side,type,match_second,period,period_second,
  annulled,annulled_at,annulled_by,source_event_id
)
select
  miss.match_id,keeper.player_id,'ours','save_penalty',miss.match_second,miss.period,miss.period_second,
  miss.annulled,miss.annulled_at,miss.annulled_by,miss.id
from public.match_events miss
cross join lateral (
  select app_private.match_goalkeeper_at(miss.match_id,miss.match_second) as player_id
) keeper
where miss.side='opponent'
  and miss.type='penalty_miss'
  and keeper.player_id is not null
  and not exists(select 1 from public.match_events linked where linked.source_event_id=miss.id)
on conflict (source_event_id) where source_event_id is not null do nothing;
