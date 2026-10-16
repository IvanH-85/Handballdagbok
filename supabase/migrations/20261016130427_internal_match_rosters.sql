begin;

alter table public.match_players
  add column if not exists team_side text not null default 'ours';

alter table public.match_players
  drop constraint if exists match_players_team_side_check;
alter table public.match_players
  add constraint match_players_team_side_check check (team_side in ('ours','opponent'));

-- Extend the established RPC functions in place so this migration preserves
-- the current access checks and all existing action behavior.
do $migration$
declare
  old_definition text;
  new_definition text;
begin
  select pg_get_functiondef(p.oid) into old_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='season_action'
    and pg_get_function_identity_arguments(p.oid)='payload jsonb';

  new_definition := replace(old_definition,
    'insert into public.match_players(match_id,player_id,starter,goalkeeper,captain,position)',
    'insert into public.match_players(match_id,player_id,starter,goalkeeper,captain,position,team_side)');
  new_definition := replace(new_definition,
    'values(mid,(item->>''playerId'')::bigint,pos<>''bench'',pos=''goalkeeper'',coalesce((item->>''captain'')::boolean,false),pos);',
    'values(mid,(item->>''playerId'')::bigint,pos<>''bench'',pos=''goalkeeper'',coalesce((item->>''captain'')::boolean,false),pos,case when item->>''teamSide''=''opponent'' then ''opponent'' else ''ours'' end);');
  new_definition := replace(new_definition,
    'update public.match_players set captain=false where match_id=mid and captain and player_id<>(select min(player_id) from public.match_players where match_id=mid and captain);',
    'update public.match_players mp set captain=false where mp.match_id=mid and mp.captain and mp.player_id<>(select min(player_id) from public.match_players where match_id=mid and team_side=mp.team_side and captain);');
  new_definition := replace(new_definition,
    'case when event_side=''ours'' then (payload->>''playerId'')::bigint else null end,event_side,',
    '(payload->>''playerId'')::bigint,event_side,');
  new_definition := replace(new_definition,
    $needle$if event_type not in ('goal_open','goal_penalty','penalty_miss','yellow','two_min','red','save_open','save_penalty') or (event_side='ours' and nullif(payload->>'playerId','') is null) then raise exception 'Velg spiller eller motstander og en hendelse.'; end if;
    period_limit := greatest(60,m.period_minutes*60);$needle$,
    $replacement$if event_type not in ('goal_open','goal_penalty','penalty_miss','yellow','two_min','red','save_open','save_penalty') or (event_side='ours' and nullif(payload->>'playerId','') is null) then raise exception 'Velg spiller eller motstander og en hendelse.'; end if;
    if nullif(payload->>'playerId','') is not null and not exists(select 1 from public.match_players where match_id=mid and player_id=(payload->>'playerId')::bigint and team_side=event_side) then raise exception 'Spilleren må være med på laget som registreres.'; end if;
    period_limit := greatest(60,m.period_minutes*60);$replacement$);
  new_definition := replace(new_definition,
    'if incoming=outgoing or not exists(select 1 from public.match_players where match_id=mid and player_id=incoming) or not exists(select 1 from public.match_players where match_id=mid and player_id=outgoing) then raise exception ''Begge spillerne må være med i laguttaket.''; end if;',
    'if incoming=outgoing or not exists(select 1 from public.match_players where match_id=mid and player_id=incoming and team_side=(select team_side from public.match_players where match_id=mid and player_id=outgoing)) or not exists(select 1 from public.match_players where match_id=mid and player_id=outgoing) then raise exception ''Begge spillerne må være med på samme laguttak.''; end if;');
  new_definition := replace(new_definition,
    'where match_id=mid and player_id=incoming and side=''ours'' and type=''red''',
    'where match_id=mid and player_id=incoming and type=''red''');

  if old_definition is null or new_definition=old_definition then
    raise exception 'Fant ikke forventet sesonghandling for intern kamp.';
  end if;
  if position('team_side=event_side' in new_definition)=0
    or position('team_side=(select team_side from public.match_players where match_id=mid and player_id=outgoing)' in new_definition)=0
    or position('side=''ours'' and type=''red''' in new_definition)>0 then
    raise exception 'Sesonghandlingen mangler lagkontroll for hendelser eller bytter.';
  end if;
  execute new_definition;

  select pg_get_functiondef(p.oid) into old_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='season_snapshot'
    and pg_get_function_identity_arguments(p.oid)='';
  new_definition := replace(old_definition,
    '''captain'',captain,''position'',position)',
    '''captain'',captain,''position'',position,''teamSide'',team_side)');
  if old_definition is null or new_definition=old_definition then
    raise exception 'Fant ikke forventet sesongoversikt for spillerlag.';
  end if;
  execute new_definition;

  select pg_get_functiondef(p.oid) into old_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='live_match_snapshot'
    and pg_get_function_identity_arguments(p.oid)='match_id_input bigint';
  new_definition := replace(old_definition,
    '''captain'', mp.captain, ''position'', mp.position',
    '''captain'', mp.captain, ''position'', mp.position, ''teamSide'', mp.team_side');
  if old_definition is null or new_definition=old_definition then
    raise exception 'Fant ikke forventet live-kampoversikt for spillerlag.';
  end if;
  execute new_definition;

  select pg_get_functiondef(p.oid) into old_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='swap_match_players_action'
    and pg_get_function_identity_arguments(p.oid)='payload jsonb';
  new_definition := replace(old_definition,
    'not exists(select 1 from public.match_players where match_id=mid and player_id=incoming)',
    'not exists(select 1 from public.match_players where match_id=mid and player_id=incoming and team_side=(select team_side from public.match_players where match_id=mid and player_id=outgoing))');
  new_definition := replace(new_definition,
    'where match_id=mid and player_id in (incoming,outgoing) and side=''ours'' and type=''red''',
    'where match_id=mid and player_id in (incoming,outgoing) and type=''red''');
  if old_definition is null or new_definition=old_definition then raise exception 'Fant ikke forventet byttefunksjon.'; end if;
  execute new_definition;

  select pg_get_functiondef(p.oid) into old_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='change_goal_scorer_action'
    and pg_get_function_identity_arguments(p.oid)='payload jsonb';
  new_definition := replace(old_definition,
    'where id=eid and side=''ours'' and type in (''goal_open'',''goal_penalty'')',
    'where id=eid and type in (''goal_open'',''goal_penalty'')');
  new_definition := replace(new_definition,
    'if not exists(select 1 from public.match_players where match_id=mid and player_id=new_player_id) then',
    'if not exists(select 1 from public.match_events e join public.match_players mp on mp.match_id=e.match_id and mp.player_id=new_player_id and mp.team_side=e.side where e.id=eid) then');
  if old_definition is null or new_definition=old_definition then raise exception 'Fant ikke forventet målscorerfunksjon.'; end if;
  execute new_definition;
end
$migration$;

revoke all on function public.season_snapshot() from public,anon;
grant execute on function public.season_snapshot() to authenticated;
revoke all on function public.live_match_snapshot(bigint) from public,anon;
grant execute on function public.live_match_snapshot(bigint) to authenticated;
revoke all on function public.swap_match_players_action(jsonb) from public,anon;
grant execute on function public.swap_match_players_action(jsonb) to authenticated;

commit;
