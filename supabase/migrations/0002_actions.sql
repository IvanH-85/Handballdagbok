begin;

create or replace function public.require_admin(u public.app_users)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if u.role <> 'admin' then raise exception 'Denne handlingen krever administratortilgang.' using errcode='42501'; end if;
end $$;

create or replace function public.require_editable_match(u public.app_users, target_match bigint)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare m public.matches;
begin
  if u.role <> 'admin' and not (u.role='match_registrar' and exists(select 1 from public.match_registrars where match_id=target_match and user_id=u.id)) then
    raise exception 'Du har ikke tilgang til å registrere denne kampen.' using errcode='42501';
  end if;
  select * into m from public.matches where id=target_match;
  if m.id is null then raise exception 'Kampen finnes ikke.'; end if;
  if m.status in ('completed','cancelled') then raise exception 'Kampen er låst. En administrator må åpne den igjen.'; end if;
  return m;
end $$;

create or replace function public.recompute_match_score(target_match bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ours integer; theirs integer;
begin
  select count(*) filter(where side='ours' and type in ('goal_open','goal_penalty')),
         count(*) filter(where side='opponent' and type in ('goal_open','goal_penalty'))
    into ours,theirs from public.match_events where match_id=target_match;
  update public.matches set our_score=ours, opponent_score=theirs where id=target_match;
  return jsonb_build_object('ourScore',ours,'opponentScore',theirs);
end $$;

create or replace function public.season_action(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  u public.app_users := public.claim_app_user();
  a text := coalesce(payload->>'action','');
  rid bigint;
  tid bigint;
  mid bigint;
  eid bigint;
  item jsonb;
  m public.matches;
  status_value text;
  pos text;
  incoming bigint;
  outgoing bigint;
  event_side text;
  event_type text;
  score jsonb;
  started_at timestamptz;
  elapsed integer;
  period_elapsed integer;
  period_limit integer;
  current_positions jsonb := '{}'::jsonb;
begin
  if a in ('addPlayer','togglePlayer','saveExercise','deleteExercise','saveTraining','deleteTraining','saveMatch','deleteMatch','saveUser','deleteUser','setTrainingStatus') then
    perform public.require_admin(u);
  end if;

  if a='addPlayer' then
    if btrim(coalesce(payload->>'name',''))='' then raise exception 'Skriv inn spillerens navn.'; end if;
    insert into public.players(name,jersey_number,shirt_size,shorts_size)
    values (btrim(payload->>'name'), nullif(payload->>'jerseyNumber','')::integer, btrim(coalesce(payload->>'shirtSize','')), btrim(coalesce(payload->>'shortsSize','')))
    returning id into rid;
    return jsonb_build_object('player',jsonb_build_object('id',rid));

  elsif a='togglePlayer' then
    update public.players set active=coalesce((payload->>'active')::boolean,false) where id=(payload->>'playerId')::bigint;
    return '{"ok":true}';

  elsif a='saveExercise' then
    if btrim(coalesce(payload->>'title',''))='' or coalesce(payload->>'category','') not in ('warmup','defense','attack','cardio','strength') then raise exception 'Tittel og kategori må fylles ut.'; end if;
    rid := nullif(payload->>'id','')::bigint;
    if rid is null then
      insert into public.exercises(title,category,description,duration_minutes,equipment,source_title,source_url)
      values (btrim(payload->>'title'),payload->>'category',btrim(coalesce(payload->>'description','')),greatest(1,coalesce((payload->>'durationMinutes')::integer,10)),btrim(coalesce(payload->>'equipment','')),btrim(coalesce(payload->>'sourceTitle','')),case when coalesce(payload->>'sourceUrl','') ~ '^https?://' then payload->>'sourceUrl' else '' end)
      returning id into rid;
    else
      update public.exercises set title=btrim(payload->>'title'),category=payload->>'category',description=btrim(coalesce(payload->>'description','')),duration_minutes=greatest(1,coalesce((payload->>'durationMinutes')::integer,10)),equipment=btrim(coalesce(payload->>'equipment','')),source_title=btrim(coalesce(payload->>'sourceTitle','')),source_url=case when coalesce(payload->>'sourceUrl','') ~ '^https?://' then payload->>'sourceUrl' else '' end where id=rid;
    end if;
    return jsonb_build_object('id',rid);

  elsif a='deleteExercise' then
    delete from public.exercises where id=(payload->>'id')::bigint;
    return '{"ok":true}';

  elsif a='saveTraining' then
    if btrim(coalesce(payload->>'date',''))='' then raise exception 'Velg dato for treningen.'; end if;
    tid := nullif(payload->>'id','')::bigint;
    if tid is not null and exists(select 1 from public.trainings where id=tid and status in ('completed','cancelled')) then raise exception 'Treningen er låst. Åpne den igjen før du redigerer.'; end if;
    if tid is null then
      insert into public.trainings(date,start_time,duration_minutes,title,theme,plan,notes)
      values ((payload->>'date')::date,btrim(coalesce(payload->>'startTime','')),greatest(1,coalesce((payload->>'durationMinutes')::integer,60)),coalesce(nullif(btrim(payload->>'title'),''),'Lagstrening'),btrim(coalesce(payload->>'theme','')),btrim(coalesce(payload->>'plan','')),btrim(coalesce(payload->>'notes',''))) returning id into tid;
    else
      update public.trainings set date=(payload->>'date')::date,start_time=btrim(coalesce(payload->>'startTime','')),duration_minutes=greatest(1,coalesce((payload->>'durationMinutes')::integer,60)),title=coalesce(nullif(btrim(payload->>'title'),''),'Lagstrening'),theme=btrim(coalesce(payload->>'theme','')),plan=btrim(coalesce(payload->>'plan','')),notes=btrim(coalesce(payload->>'notes','')) where id=tid;
    end if;
    delete from public.training_attendance where training_id=tid;
    for item in select value from jsonb_array_elements(coalesce(payload->'playerIds','[]')) loop
      insert into public.training_attendance(training_id,player_id) values(tid,(item#>>'{}')::bigint) on conflict do nothing;
    end loop;
    delete from public.training_exercises where training_id=tid;
    for item in select value from jsonb_array_elements(coalesce(payload->'exerciseItems','[]')) loop
      if coalesce(item->>'section','') in ('warmup','technique','match') then
        insert into public.training_exercises(training_id,exercise_id,section,sort_order,duration_minutes,notes)
        values(tid,(item->>'exerciseId')::bigint,item->>'section',coalesce((item->>'sortOrder')::integer,0),greatest(1,coalesce((item->>'durationMinutes')::integer,10)),btrim(coalesce(item->>'notes','')));
      end if;
    end loop;
    return jsonb_build_object('id',tid);

  elsif a='deleteTraining' then
    tid := (payload->>'id')::bigint;
    if exists(select 1 from public.trainings where id=tid and status in ('completed','cancelled')) then raise exception 'Treningen er låst. Åpne den igjen før du sletter.'; end if;
    delete from public.trainings where id=tid;
    return '{"ok":true}';

  elsif a='setTrainingStatus' then
    status_value := payload->>'status';
    if status_value not in ('planned','completed','cancelled') then raise exception 'Ugyldig trening eller status.'; end if;
    update public.trainings set status=status_value,completed_at=case when status_value='completed' then now() else null end where id=(payload->>'id')::bigint;
    return '{"ok":true}';

  elsif a='saveMatch' then
    if btrim(coalesce(payload->>'date',''))='' or btrim(coalesce(payload->>'opponent',''))='' then raise exception 'Dato og motstander må fylles ut.'; end if;
    mid := nullif(payload->>'id','')::bigint;
    if mid is not null and exists(select 1 from public.matches where id=mid and status in ('completed','cancelled')) then raise exception 'Kampen er låst. Åpne den igjen før du redigerer.'; end if;
    status_value := case when coalesce(payload->>'matchType','') in ('league','cup','friendly') then payload->>'matchType' else 'league' end;
    if status_value='cup' and btrim(coalesce(payload->>'cupName',''))='' then raise exception 'Skriv inn navnet på cupen.'; end if;
    if mid is null then
      insert into public.matches(date,start_time,opponent,team,home_away,competition,match_type,cup_name,venue,our_score,opponent_score,period_count,period_minutes,notes)
      values((payload->>'date')::date,btrim(coalesce(payload->>'startTime','')),btrim(payload->>'opponent'),coalesce(nullif(btrim(payload->>'team'),''),'Stokmarknes'),case when payload->>'homeAway'='away' then 'away' else 'home' end,case when status_value='cup' then btrim(payload->>'cupName') when status_value='friendly' then 'Vennskapskamp' else coalesce(nullif(btrim(payload->>'competition'),''),'J12-serien 2026/27') end,status_value,case when status_value='cup' then btrim(payload->>'cupName') else '' end,btrim(coalesce(payload->>'venue','')),nullif(payload->>'ourScore','')::integer,nullif(payload->>'opponentScore','')::integer,2,case when status_value='league' then 20 else least(60,greatest(1,coalesce((payload->>'periodMinutes')::integer,20))) end,btrim(coalesce(payload->>'notes',''))) returning id into mid;
    else
      update public.matches set date=(payload->>'date')::date,start_time=btrim(coalesce(payload->>'startTime','')),opponent=btrim(payload->>'opponent'),team=coalesce(nullif(btrim(payload->>'team'),''),'Stokmarknes'),home_away=case when payload->>'homeAway'='away' then 'away' else 'home' end,competition=case when status_value='cup' then btrim(payload->>'cupName') when status_value='friendly' then 'Vennskapskamp' else coalesce(nullif(btrim(payload->>'competition'),''),'J12-serien 2026/27') end,match_type=status_value,cup_name=case when status_value='cup' then btrim(payload->>'cupName') else '' end,venue=btrim(coalesce(payload->>'venue','')),our_score=nullif(payload->>'ourScore','')::integer,opponent_score=nullif(payload->>'opponentScore','')::integer,period_count=2,period_minutes=case when status_value='league' then 20 else least(60,greatest(1,coalesce((payload->>'periodMinutes')::integer,20))) end,notes=btrim(coalesce(payload->>'notes','')) where id=mid;
    end if;
    delete from public.match_players where match_id=mid;
    for item in select value from jsonb_array_elements(coalesce(payload->'roster','[]')) loop
      pos := case when coalesce(item->>'position','') in ('goalkeeper','right_wing','right_back','center','left_back','left_wing','bench') then item->>'position' when coalesce((item->>'goalkeeper')::boolean,false) then 'goalkeeper' else 'bench' end;
      insert into public.match_players(match_id,player_id,starter,goalkeeper,captain,position)
      values(mid,(item->>'playerId')::bigint,pos<>'bench',pos='goalkeeper',coalesce((item->>'captain')::boolean,false),pos);
    end loop;
    -- Preserve the original rule that only one captain can be selected.
    update public.match_players set captain=false where match_id=mid and captain and player_id<>(select min(player_id) from public.match_players where match_id=mid and captain);
    delete from public.match_registrars where match_id=mid;
    if nullif(payload->>'registrarUserId','') is not null then insert into public.match_registrars(match_id,user_id) select mid,id from public.app_users where id=(payload->>'registrarUserId')::bigint and role='match_registrar' and active; end if;
    return jsonb_build_object('id',mid);

  elsif a='deleteMatch' then
    mid := (payload->>'id')::bigint;
    if exists(select 1 from public.matches where id=mid and status in ('completed','cancelled')) then raise exception 'Kampen er låst. Åpne den igjen før du sletter.'; end if;
    delete from public.matches where id=mid;
    return '{"ok":true}';

  elsif a='saveUser' then
    rid := nullif(payload->>'id','')::bigint;
    status_value := payload->>'role';
    if btrim(coalesce(payload->>'name',''))='' or status_value not in ('admin','parent','match_registrar') or (btrim(coalesce(payload->>'email',''))='' and regexp_replace(coalesce(payload->>'phone',''),'\D','','g')='') then raise exception 'Navn, rolle og e-post eller telefonnummer må fylles ut.'; end if;
    if rid=u.id and (not coalesce((payload->>'active')::boolean,true) or status_value<>'admin') then raise exception 'Du kan ikke fjerne din egen administratortilgang.'; end if;
    if rid is null then
      insert into public.app_users(name,email,phone,role,active) values(btrim(payload->>'name'),nullif(lower(btrim(payload->>'email')),''),btrim(coalesce(payload->>'phone','')),status_value,coalesce((payload->>'active')::boolean,true)) returning id into rid;
    else
      update public.app_users set name=btrim(payload->>'name'),email=nullif(lower(btrim(payload->>'email')),''),phone=btrim(coalesce(payload->>'phone','')),role=status_value,active=coalesce((payload->>'active')::boolean,true),account_user_id=case when lower(coalesce(email,''))=lower(coalesce(payload->>'email','')) and regexp_replace(phone,'\D','','g')=regexp_replace(coalesce(payload->>'phone',''),'\D','','g') then account_user_id else null end where id=rid;
    end if;
    return jsonb_build_object('id',rid);

  elsif a='deleteUser' then
    rid := (payload->>'id')::bigint;
    if rid=u.id then raise exception 'Du kan ikke slette din egen bruker.'; end if;
    delete from public.app_users where id=rid;
    return '{"ok":true}';

  elsif a='saveMatchNotes' then
    mid := (payload->>'matchId')::bigint; perform public.require_editable_match(u,mid);
    update public.matches set notes=btrim(coalesce(payload->>'notes','')) where id=mid;
    return '{"ok":true}';

  elsif a='addEvent' then
    mid := (payload->>'matchId')::bigint; m := public.require_editable_match(u,mid);
    event_side := case when payload->>'side'='opponent' then 'opponent' else 'ours' end;
    event_type := payload->>'eventType';
    if event_type not in ('goal_open','goal_penalty','penalty_miss','yellow','two_min','red','save_open','save_penalty') or (event_side='ours' and nullif(payload->>'playerId','') is null) then raise exception 'Velg spiller eller motstander og en hendelse.'; end if;
    period_limit := greatest(60,m.period_minutes*60);
    insert into public.match_events(match_id,player_id,side,type,match_second,period,period_second)
    values(mid,case when event_side='ours' then (payload->>'playerId')::bigint else null end,event_side,event_type,greatest(0,coalesce((payload->>'matchSecond')::integer,0)),case when m.current_period=2 then 2 else 1 end,least(period_limit,greatest(0,coalesce((payload->>'periodSecond')::integer,coalesce((payload->>'matchSecond')::integer,0))))) returning id into eid;
    score := public.recompute_match_score(mid);
    return jsonb_build_object('event',jsonb_build_object('id',eid),'score',score);

  elsif a='deleteEvent' then
    eid := (payload->>'eventId')::bigint; select match_id into mid from public.match_events where id=eid;
    if mid is null then raise exception 'Hendelsen finnes ikke.'; end if;
    perform public.require_editable_match(u,mid); delete from public.match_events where id=eid; score:=public.recompute_match_score(mid);
    return jsonb_build_object('ok',true,'score',score);

  elsif a='setMatchStatus' then
    mid := (payload->>'matchId')::bigint; status_value:=payload->>'status';
    if status_value not in ('planned','live','completed','cancelled') then raise exception 'Ugyldig kamp eller status.'; end if;
    if status_value='completed' then perform public.require_editable_match(u,mid); else perform public.require_admin(u); end if;
    update public.matches set status=status_value,completed_at=case when status_value='completed' then now() else null end,clock_running=false,clock_started_at=null,elapsed_seconds=case when status_value='completed' then coalesce((payload->>'elapsedSeconds')::integer,elapsed_seconds) else elapsed_seconds end,period_elapsed_seconds=case when status_value='completed' then coalesce((payload->>'periodElapsedSeconds')::integer,period_elapsed_seconds) else period_elapsed_seconds end,match_phase=case when status_value='completed' then 'completed' when status_value='planned' then case when current_period>=2 then 'second_half' when current_period=1 then 'first_half' else 'pre_match' end else match_phase end where id=mid;
    return '{"ok":true}';

  elsif a='setMatchClock' then
    mid := (payload->>'matchId')::bigint; m:=public.require_editable_match(u,mid); status_value:=payload->>'clockMode';
    elapsed:=greatest(0,coalesce((payload->>'elapsedSeconds')::integer,0)); period_limit:=greatest(60,m.period_minutes*60); period_elapsed:=least(period_limit,greatest(0,coalesce((payload->>'periodElapsedSeconds')::integer,0))); elapsed:=greatest(0,elapsed-greatest(0,coalesce((payload->>'periodElapsedSeconds')::integer,0)-period_elapsed));
    if status_value in ('start_first','start','start_second') then started_at:=nullif(payload->>'clockStartedAt','')::timestamptz; if started_at is null then raise exception 'Kunne ikke starte kampklokken.'; end if; end if;
    if status_value='start_first' and m.match_phase='pre_match' then update public.matches set elapsed_seconds=0,period_elapsed_seconds=0,current_period=1,match_phase='first_half',clock_started_at=started_at,clock_running=true,status='live' where id=mid;
    elsif status_value='start' and m.match_phase in ('first_half','second_half') then update public.matches set elapsed_seconds=elapsed,period_elapsed_seconds=period_elapsed,clock_started_at=started_at,clock_running=true,status='live' where id=mid;
    elsif status_value='pause' and m.match_phase in ('first_half','second_half') then update public.matches set elapsed_seconds=elapsed,period_elapsed_seconds=period_elapsed,clock_started_at=null,clock_running=false where id=mid;
    elsif status_value='finish_period' and m.match_phase='first_half' then update public.matches set elapsed_seconds=elapsed,period_elapsed_seconds=period_elapsed,current_period=1,match_phase='halftime',clock_started_at=null,clock_running=false,status='live' where id=mid;
    elsif status_value='start_second' and m.match_phase='halftime' then update public.matches set elapsed_seconds=elapsed,period_elapsed_seconds=0,current_period=2,match_phase='second_half',clock_started_at=started_at,clock_running=true,status='live' where id=mid;
    elsif status_value='reset' then if exists(select 1 from public.match_events where match_id=mid union all select 1 from public.match_substitutions where match_id=mid) then raise exception 'Kampklokken kan ikke nullstilles etter at hendelser eller bytter er registrert.'; end if; update public.matches set elapsed_seconds=0,period_elapsed_seconds=0,current_period=0,match_phase='pre_match',clock_started_at=null,clock_running=false,status='planned' where id=mid;
    else raise exception 'Ugyldig valg eller kampfase for kampklokken.'; end if;
    return '{"ok":true}';

  elsif a='addSubstitution' then
    mid:=(payload->>'matchId')::bigint; incoming:=(payload->>'playerInId')::bigint; outgoing:=(payload->>'playerOutId')::bigint; m:=public.require_editable_match(u,mid);
    if incoming=outgoing or not exists(select 1 from public.match_players where match_id=mid and player_id=incoming) or not exists(select 1 from public.match_players where match_id=mid and player_id=outgoing) then raise exception 'Begge spillerne må være med i laguttaket.'; end if;
    if exists(select 1 from public.match_events where match_id=mid and player_id=incoming and side='ours' and type='red') then raise exception 'En spiller med rødt kort kan ikke byttes inn igjen.'; end if;
    select coalesce(jsonb_object_agg(player_id::text,position),'{}') into current_positions from public.match_players where match_id=mid;
    for item in select jsonb_build_object('in',player_in_id,'out',player_out_id,'position',position) from public.match_substitutions where match_id=mid order by id loop
      current_positions:=jsonb_set(current_positions,array[item->>'out'],to_jsonb('bench'::text)); current_positions:=jsonb_set(current_positions,array[item->>'in'],to_jsonb(item->>'position'));
    end loop;
    pos:=current_positions->>outgoing::text;
    if pos not in ('goalkeeper','right_wing','right_back','center','left_back','left_wing') or current_positions->>incoming::text <> 'bench' then raise exception 'Byttet stemmer ikke med spillerne som er på banen og benken.'; end if;
    period_limit:=greatest(60,m.period_minutes*60);
    insert into public.match_substitutions(match_id,player_in_id,player_out_id,position,match_second,period,period_second) values(mid,incoming,outgoing,pos,greatest(0,coalesce((payload->>'matchSecond')::integer,0)),case when m.current_period=2 then 2 else 1 end,least(period_limit,greatest(0,coalesce((payload->>'periodSecond')::integer,coalesce((payload->>'matchSecond')::integer,0))))) returning id into rid;
    return jsonb_build_object('substitution',jsonb_build_object('id',rid));

  elsif a='deleteSubstitution' then
    rid:=(payload->>'id')::bigint; select match_id into mid from public.match_substitutions where id=rid; if mid is null then raise exception 'Byttet finnes ikke.'; end if; perform public.require_editable_match(u,mid);
    if rid<>(select max(id) from public.match_substitutions where match_id=mid) then raise exception 'Bare det siste byttet kan angres.'; end if;
    delete from public.match_substitutions where id=rid; return '{"ok":true}';
  end if;

  raise exception 'Ukjent handling.';
end;
$$;

revoke all on function public.require_admin(public.app_users) from public,anon,authenticated;
revoke all on function public.require_editable_match(public.app_users,bigint) from public,anon,authenticated;
revoke all on function public.recompute_match_score(bigint) from public,anon,authenticated;
revoke all on function public.season_action(jsonb) from public,anon;
grant execute on function public.season_action(jsonb) to authenticated;

commit;
