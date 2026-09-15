CREATE OR REPLACE FUNCTION public.cup_action(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u public.app_users := public.claim_app_user();
  a text := coalesce(payload->>'action','');
  cid bigint := nullif(payload->>'cupId','')::bigint;
  cup_team_key bigint := nullif(payload->>'cupTeamId','')::bigint;
  mid bigint;
  registrar_id bigint := nullif(payload->>'registrarUserId','')::bigint;
  team_count integer;
  current_count integer;
  item jsonb;
  cup_row public.cups;
  team_row public.cup_teams;
  pos text;
begin
  perform public.require_admin(u);
  if a='saveCup' then
    if btrim(coalesce(payload->>'name',''))='' or nullif(payload->>'startDate','') is null or nullif(payload->>'endDate','') is null then raise exception 'Navn og dato må fylles ut.'; end if;
    team_count := least(6,greatest(1,coalesce((payload->>'teamCount')::integer,1)));
    if cid is null then
      insert into public.cups(name,start_date,end_date,venue,period_count,period_minutes)
      values(
        btrim(payload->>'name'),(payload->>'startDate')::date,(payload->>'endDate')::date,
        btrim(coalesce(payload->>'venue','')),
        least(2,greatest(1,coalesce((payload->>'periodCount')::integer,2))),
        least(60,greatest(1,coalesce((payload->>'periodMinutes')::integer,18)))
      ) returning id into cid;
    else
      update public.cups set
        name=btrim(payload->>'name'),start_date=(payload->>'startDate')::date,end_date=(payload->>'endDate')::date,
        venue=btrim(coalesce(payload->>'venue','')),
        period_count=least(2,greatest(1,coalesce((payload->>'periodCount')::integer,2))),
        period_minutes=least(60,greatest(1,coalesce((payload->>'periodMinutes')::integer,18)))
      where id=cid;
      if not found then raise exception 'Cupen finnes ikke.'; end if;
    end if;
    select count(*) into current_count from public.cup_teams where cup_id=cid;
    if team_count > current_count then
      for current_count in current_count+1..team_count loop
        insert into public.cup_teams(cup_id,name,sort_order) values(cid,case when team_count=1 then 'STHK' else 'STHK '||current_count end,current_count);
      end loop;
    elsif team_count < current_count then
      if exists(select 1 from public.matches m join public.cup_teams t on t.id=m.cup_team_id where t.cup_id=cid and t.sort_order>team_count) then raise exception 'Fjern kampene til laget før du reduserer antall lag.'; end if;
      delete from public.cup_teams where cup_id=cid and sort_order>team_count;
    end if;
    if team_count>1 then update public.cup_teams set name='STHK '||sort_order where cup_id=cid; else update public.cup_teams set name='STHK' where cup_id=cid; end if;
    return jsonb_build_object('id',cid);
  elsif a='saveCupRosters' then
    if cid is null or not exists(select 1 from public.cups where id=cid) then raise exception 'Cupen finnes ikke.'; end if;
    delete from public.cup_team_players where cup_id=cid;
    for item in select value from jsonb_array_elements(coalesce(payload->'assignments','[]')) loop
      cup_team_key:=nullif(item->>'cupTeamId','')::bigint;
      if not exists(select 1 from public.cup_teams where id=cup_team_key and cup_id=cid) then raise exception 'Et valgt lag tilhører ikke cupen.'; end if;
      if not exists(select 1 from public.players where id=(item->>'playerId')::bigint and active) then raise exception 'En valgt spiller finnes ikke eller er deaktivert.'; end if;
      insert into public.cup_team_players values(cid,cup_team_key,(item->>'playerId')::bigint);
    end loop;
    return '{"ok":true}';
  elsif a='saveCupMatch' then
    select * into cup_row from public.cups where id=cid;
    select * into team_row from public.cup_teams where id=cup_team_key and cup_id=cid;
    if cup_row.id is null or team_row.id is null then raise exception 'Velg cup og lag.'; end if;
    if btrim(coalesce(payload->>'date',''))='' or btrim(coalesce(payload->>'opponent',''))='' then raise exception 'Dato og motstander må fylles ut.'; end if;
    if registrar_id is not null and not exists(
      select 1 from public.app_users au
      join public.player_guardians pg on pg.user_id=au.id
      join public.cup_team_players ctp on ctp.player_id=pg.player_id and ctp.cup_id=cid and ctp.cup_team_id=cup_team_key
      where au.id=registrar_id and au.active and au.role='parent'
    ) then raise exception 'Kampregistratoren må være foresatt til en spiller på laget.'; end if;
    insert into public.matches(date,start_time,opponent,team,home_away,competition,match_type,cup_name,venue,period_count,period_minutes,notes,cup_id,cup_team_id)
    values(
      (payload->>'date')::date,btrim(coalesce(payload->>'startTime','')),btrim(payload->>'opponent'),team_row.name,
      case when payload->>'homeAway'='away' then 'away' else 'home' end,
      cup_row.name,'cup',cup_row.name,coalesce(nullif(btrim(coalesce(payload->>'venue','')),''),cup_row.venue),
      cup_row.period_count,cup_row.period_minutes,btrim(coalesce(payload->>'notes','')),cid,cup_team_key
    ) returning id into mid;
    for item in select value from jsonb_array_elements(coalesce(payload->'roster','[]')) loop
      if not exists(select 1 from public.cup_team_players where cup_id=cid and cup_team_id=cup_team_key and player_id=(item->>'playerId')::bigint) then raise exception 'Laguttaket inneholder en spiller som ikke er på cuplaget.'; end if;
      pos:=case when coalesce(item->>'position','') in ('goalkeeper','right_wing','right_back','center','left_back','left_wing','bench') then item->>'position' else 'bench' end;
      insert into public.match_players(match_id,player_id,starter,goalkeeper,captain,position)
      values(mid,(item->>'playerId')::bigint,pos<>'bench',pos='goalkeeper',coalesce((item->>'captain')::boolean,false),pos);
    end loop;
    update public.match_players set captain=false where match_id=mid and captain and player_id<>(select min(player_id) from public.match_players where match_id=mid and captain);
    if registrar_id is not null then insert into public.match_registrars values(mid,registrar_id); end if;
    return jsonb_build_object('id',mid);
  elsif a='deleteCup' then
    if cid is null or not exists(select 1 from public.cups where id=cid) then raise exception 'Cupen finnes ikke.'; end if;
    delete from public.cups where id=cid;
    return '{"ok":true}';
  end if;
  raise exception 'Ukjent cuphandling.';
end;
$function$;

revoke all on function public.cup_action(jsonb) from public, anon;
grant execute on function public.cup_action(jsonb) to authenticated;

