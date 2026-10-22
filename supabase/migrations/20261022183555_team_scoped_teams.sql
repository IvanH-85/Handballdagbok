begin;

create table public.teams (
  slug text primary key,
  name text not null
);
insert into public.teams(slug,name) values
  ('sthk2015','STHK 2015'),
  ('sthk2014','STHK 2014')
on conflict (slug) do update set name=excluded.name;

create table public.team_memberships (
  user_id bigint not null references public.app_users(id) on delete cascade,
  team_slug text not null references public.teams(slug) on delete cascade,
  role text not null check (role in ('admin','parent','match_registrar')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id,team_slug)
);
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
revoke all on table public.teams, public.team_memberships from public, anon, authenticated;

insert into public.team_memberships(user_id,team_slug,role,active)
select id,'sthk2015',role,active from public.app_users
on conflict (user_id,team_slug) do nothing;
insert into public.team_memberships(user_id,team_slug,role)
select id,'sthk2014','admin' from public.app_users
where active and lower(email) in ('ivanhansen1985@hotmail.com','espenellingsen@outlook.com')
on conflict (user_id,team_slug) do update set role='admin',active=true;

-- Keep login analytics inside the selected team, even when an administrator
-- account belongs to more than one team.
alter table public.user_login_sessions add column team_slug text not null default 'sthk2015' references public.teams(slug);
alter table public.user_login_sessions drop constraint user_login_sessions_pkey;
alter table public.user_login_sessions add primary key(session_id,team_slug);

alter table public.players add column team_slug text not null default 'sthk2015' references public.teams(slug);
alter table public.trainings add column team_slug text not null default 'sthk2015' references public.teams(slug);
alter table public.exercises add column team_slug text not null default 'sthk2015' references public.teams(slug);
alter table public.matches add column team_slug text not null default 'sthk2015' references public.teams(slug);
alter table public.cups add column team_slug text not null default 'sthk2015' references public.teams(slug);
create index players_team_idx on public.players(team_slug,active,jersey_number,name);
create index trainings_team_date_idx on public.trainings(team_slug,date,start_time);
create index exercises_team_idx on public.exercises(team_slug,category,title);
create index matches_team_date_idx on public.matches(team_slug,date,start_time);
create index cups_team_date_idx on public.cups(team_slug,start_date);

create or replace function public.claim_app_user()
returns public.app_users
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  jwt jsonb := auth.jwt();
  headers jsonb := coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb);
  requested_slug text := nullif(headers->>'x-team-slug','');
  mail text := lower(coalesce(jwt->>'email',''));
  phone_digits text := regexp_replace(coalesce(jwt->>'phone',''), '\D', '', 'g');
  result public.app_users;
  membership public.team_memberships;
  membership_count integer;
begin
  if uid is null then raise exception 'Logg inn for å fortsette.' using errcode = '28000'; end if;
  -- app_users.active/role are legacy global columns. Memberships carry the
  -- team-specific access state, so do not let one team's deactivation revoke
  -- another team's account.
  select * into result from public.app_users where account_user_id=uid limit 1;
  if not found then
    update public.app_users set account_user_id=uid
    where id=(select id from public.app_users where active and account_user_id is null
      and ((mail<>'' and lower(coalesce(email,''))=mail)
        or (phone_digits<>'' and regexp_replace(phone,'\D','','g')=phone_digits))
      order by id limit 1)
    returning * into result;
  end if;
  if result.id is null then raise exception 'Brukeren er ikke forhåndsgodkjent.' using errcode='42501'; end if;

  select count(*) into membership_count from public.team_memberships where user_id=result.id and active;
  if requested_slug is not null then
    select * into membership from public.team_memberships
      where user_id=result.id and team_slug=requested_slug and active;
  end if;
  if membership.user_id is null and membership_count=1 then
    select * into membership from public.team_memberships where user_id=result.id and active limit 1;
  end if;
  if membership.user_id is null then
    raise exception 'Du har ikke tilgang til dette laget.' using errcode='42501';
  end if;
  result.role := membership.role;
  perform set_config('app.active_team_slug',membership.team_slug,true);
  perform set_config('app.active_team_role',membership.role,true);
  return result;
end;
$$;

create or replace function public.current_team_slug()
returns text language plpgsql stable security definer set search_path = '' as $$
declare slug text := nullif(current_setting('app.active_team_slug',true),'');
begin
  if slug is null then raise exception 'Lagtilgang er ikke initialisert.' using errcode='42501'; end if;
  return slug;
end $$;

create or replace function public.guard_team_data()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  active_slug text := public.current_team_slug();
  old_slug text;
  new_slug text;
  ref_slug text;
begin
  if tg_table_name in ('players','trainings','exercises','matches','cups') then
    if tg_op <> 'INSERT' then
      old_slug := old.team_slug;
      if old_slug <> active_slug then raise exception 'Du har ikke tilgang til dette laget.' using errcode='42501'; end if;
    end if;
    if tg_op <> 'DELETE' then new.team_slug := active_slug; end if;
    if tg_op='DELETE' then return old; else return new; end if;
  end if;

  if tg_op <> 'INSERT' then
    case tg_table_name
      when 'training_attendance','training_exercises','training_observations' then select team_slug into old_slug from public.trainings where id=old.training_id;
      when 'match_players','match_events','match_substitutions','match_registrars','match_comments' then select team_slug into old_slug from public.matches where id=old.match_id;
      when 'cup_teams' then select team_slug into old_slug from public.cups where id=old.cup_id;
      when 'cup_team_players' then select team_slug into old_slug from public.cups where id=old.cup_id;
      when 'player_guardians' then select team_slug into old_slug from public.players where id=old.player_id;
    end case;
    -- Parent deletes cascade after the parent row is gone. A missing parent
    -- here can only be that cascade because live child rows have an FK.
    if old_slug is null and tg_op='DELETE' then return old; end if;
    if old_slug is distinct from active_slug then raise exception 'Du har ikke tilgang til dette laget.' using errcode='42501'; end if;
  end if;

  if tg_op <> 'DELETE' then
    case tg_table_name
      when 'training_attendance','training_exercises','training_observations' then select team_slug into new_slug from public.trainings where id=new.training_id;
      when 'match_players','match_events','match_substitutions','match_registrars','match_comments' then select team_slug into new_slug from public.matches where id=new.match_id;
      when 'cup_teams' then select team_slug into new_slug from public.cups where id=new.cup_id;
      when 'cup_team_players' then select team_slug into new_slug from public.cups where id=new.cup_id;
      when 'player_guardians' then select team_slug into new_slug from public.players where id=new.player_id;
    end case;
    if new_slug is distinct from active_slug then raise exception 'Du har ikke tilgang til dette laget.' using errcode='42501'; end if;
    if tg_table_name='training_attendance' or tg_table_name='training_observations' then
      select team_slug into ref_slug from public.players where id=new.player_id;
      if ref_slug is distinct from active_slug then raise exception 'Spilleren tilhører et annet lag.' using errcode='42501'; end if;
    elsif tg_table_name='match_players' then
      select team_slug into ref_slug from public.players where id=new.player_id;
      if ref_slug is distinct from active_slug then raise exception 'Spilleren tilhører et annet lag.' using errcode='42501'; end if;
    elsif tg_table_name='match_events' and new.player_id is not null then
      select team_slug into ref_slug from public.players where id=new.player_id;
      if ref_slug is distinct from active_slug then raise exception 'Spilleren tilhører et annet lag.' using errcode='42501'; end if;
    elsif tg_table_name='match_substitutions' then
      if not exists(select 1 from public.players where id=new.player_in_id and team_slug=active_slug)
         or not exists(select 1 from public.players where id=new.player_out_id and team_slug=active_slug) then
        raise exception 'Spillerne tilhører et annet lag.' using errcode='42501';
      end if;
    elsif tg_table_name='cup_team_players' then
      if not exists(select 1 from public.players where id=new.player_id and team_slug=active_slug) then raise exception 'Spilleren tilhører et annet lag.' using errcode='42501'; end if;
      if not exists(select 1 from public.cup_teams where id=new.cup_team_id and cup_id=new.cup_id) then raise exception 'Cuplaget finnes ikke i denne cupen.' using errcode='42501'; end if;
    elsif tg_table_name='training_exercises' then
      if not exists(select 1 from public.exercises where id=new.exercise_id and team_slug=active_slug) then raise exception 'Øvelsen tilhører et annet lag.' using errcode='42501'; end if;
    elsif tg_table_name='player_guardians' then
      if not exists(select 1 from public.team_memberships where user_id=new.user_id and team_slug=active_slug and active) then raise exception 'Foresatte må ha tilgang til samme lag.' using errcode='42501'; end if;
    elsif tg_table_name='match_registrars' then
      if not exists(select 1 from public.team_memberships where user_id=new.user_id and team_slug=active_slug and active) then raise exception 'Kampregistratoren må ha tilgang til samme lag.' using errcode='42501'; end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

do $$ declare t text; begin
  foreach t in array array['players','trainings','exercises','matches','cups','training_attendance','training_exercises','training_observations','match_players','match_events','match_substitutions','match_registrars','match_comments','cup_teams','cup_team_players','player_guardians'] loop
    execute format('drop trigger if exists team_scope_guard on public.%I',t);
    execute format('create trigger team_scope_guard before insert or update or delete on public.%I for each row execute function public.guard_team_data()',t);
  end loop;
end $$;

create or replace function public.require_editable_match(u public.app_users, target_match bigint)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare m public.matches;
begin
  if u.role <> 'admin' and not (u.role='match_registrar' and exists(select 1 from public.match_registrars where match_id=target_match and user_id=u.id)) then
    raise exception 'Du har ikke tilgang til å registrere denne kampen.' using errcode='42501';
  end if;
  select * into m from public.matches where id=target_match and team_slug=public.current_team_slug();
  if m.id is null then raise exception 'Kampen finnes ikke.'; end if;
  if m.status in ('completed','cancelled') then raise exception 'Kampen er låst. En administrator må åpne den igjen.'; end if;
  return m;
end $$;

create or replace function public.ensure_user_team_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
declare active_slug text := public.current_team_slug();
begin
  insert into public.team_memberships(user_id,team_slug,role,active)
  values(new.id,active_slug,new.role,new.active)
  on conflict(user_id,team_slug) do update set role=excluded.role,active=excluded.active;
  return new;
end $$;
create or replace function public.delete_user_from_current_team()
returns trigger language plpgsql security definer set search_path = '' as $$
declare active_slug text := public.current_team_slug();
begin
  delete from public.team_memberships where user_id=old.id and team_slug=active_slug;
  if exists(select 1 from public.team_memberships where user_id=old.id) then return null; end if;
  return old;
end $$;
drop trigger if exists app_users_team_membership on public.app_users;
drop trigger if exists app_users_delete_team_membership on public.app_users;
create trigger app_users_team_membership after insert or update of role,active on public.app_users for each row execute function public.ensure_user_team_membership();
create trigger app_users_delete_team_membership before delete on public.app_users for each row execute function public.delete_user_from_current_team();

-- Restrict the shared season payload to the selected team's records.
create or replace function public.season_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u public.app_users := public.claim_app_user();
  team_slug_value text := public.current_team_slug();
  match_ids bigint[];
begin
  select coalesce(array_agg(id),array[]::bigint[]) into match_ids from public.matches where team_slug=team_slug_value;
  return jsonb_build_object(
    'players', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'jerseyNumber',jersey_number,'shirtSize',case when u.role='admin' then shirt_size else '' end,'shortsSize',case when u.role='admin' then shorts_size else '' end,'active',active,'createdAt',created_at) order by active desc,jersey_number,name),'[]') from public.players where team_slug=team_slug_value),
    'trainings', case when u.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'date',date,'startTime',start_time,'durationMinutes',duration_minutes,'title',title,'theme',theme,'plan',plan,'notes',notes,'attendanceRecorded',attendance_recorded,'status',status,'completedAt',completed_at,'createdAt',created_at) order by date desc,start_time desc),'[]') from public.trainings where team_slug=team_slug_value) else '[]'::jsonb end,
    'attendance', case when u.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('trainingId',a.training_id,'playerId',a.player_id)),'[]') from public.training_attendance a join public.trainings t on t.id=a.training_id where t.team_slug=team_slug_value) else '[]'::jsonb end,
    'exercises', case when u.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'seedKey',seed_key,'title',title,'category',category,'description',description,'durationMinutes',duration_minutes,'equipment',equipment,'sourceTitle',source_title,'sourceUrl',source_url,'createdAt',created_at) order by category,title),'[]') from public.exercises where team_slug=team_slug_value) else '[]'::jsonb end,
    'trainingExercises', case when u.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'trainingId',e.training_id,'exerciseId',e.exercise_id,'section',e.section,'sortOrder',e.sort_order,'durationMinutes',e.duration_minutes,'notes',e.notes) order by e.training_id,e.section,e.sort_order,e.id),'[]') from public.training_exercises e join public.trainings t on t.id=e.training_id where t.team_slug=team_slug_value) else '[]'::jsonb end,
    'matches', (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'date',m.date,'startTime',m.start_time,'opponent',m.opponent,'team',m.team,'homeAway',m.home_away,'competition',m.competition,'matchType',m.match_type,'cupName',m.cup_name,'venue',m.venue,'registrarName',(select au.name from public.match_registrars mr join public.app_users au on au.id=mr.user_id where mr.match_id=m.id order by au.name limit 1),'ourScore',m.our_score,'opponentScore',m.opponent_score,'periodCount',m.period_count,'periodMinutes',m.period_minutes,'matchPhase',m.match_phase,'currentPeriod',m.current_period,'periodElapsedSeconds',m.period_elapsed_seconds,'clockStartedAt',m.clock_started_at,'elapsedSeconds',m.elapsed_seconds,'clockRunning',m.clock_running,'notes',case when u.role='admin' or exists(select 1 from public.match_registrars mr where mr.match_id=m.id and mr.user_id=u.id) then m.notes else '' end,'status',m.status,'completedAt',m.completed_at,'createdAt',m.created_at) order by m.date,m.start_time),'[]') from public.matches m where m.team_slug=team_slug_value),
    'matchPlayers', (select coalesce(jsonb_agg(jsonb_build_object('matchId',match_id,'playerId',player_id,'starter',starter,'goalkeeper',goalkeeper,'captain',captain,'position',position,'teamSide',team_side)),'[]') from public.match_players where match_id=any(match_ids)),
    'matchEvents', case when u.role<>'parent' then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'matchId',match_id,'playerId',player_id,'side',side,'type',type,'matchSecond',match_second,'period',period,'periodSecond',period_second,'annulled',annulled,'createdAt',created_at) order by id desc),'[]') from public.match_events where match_id=any(match_ids)) else '[]'::jsonb end,
    'matchSubstitutions', case when u.role<>'parent' then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'matchId',match_id,'playerInId',player_in_id,'playerOutId',player_out_id,'position',position,'swap',swap,'playerInPreviousPosition',player_in_previous_position,'matchSecond',match_second,'period',period,'periodSecond',period_second,'createdAt',created_at) order by id),'[]') from public.match_substitutions where match_id=any(match_ids)) else '[]'::jsonb end,
    'appUsers', case when u.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('id',au.id,'name',au.name,'email',au.email,'phone',au.phone,'role',tm.role,'active',tm.active,'accountUserId',au.account_user_id,'createdAt',au.created_at) order by tm.role,au.name),'[]') from public.app_users au join public.team_memberships tm on tm.user_id=au.id where tm.team_slug=team_slug_value) else '[]'::jsonb end,
    'matchRegistrars', case when u.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('matchId',mr.match_id,'userId',mr.user_id)),'[]') from public.match_registrars mr join public.matches m on m.id=mr.match_id where m.team_slug=team_slug_value) else (select coalesce(jsonb_agg(jsonb_build_object('matchId',mr.match_id,'userId',mr.user_id)),'[]') from public.match_registrars mr where mr.user_id=u.id and mr.match_id=any(match_ids)) end,
    'currentUser', jsonb_build_object('id',u.id,'name',u.name,'email',u.email,'role',u.role,'teamSlug',team_slug_value,'teamName',(select name from public.teams where slug=team_slug_value),'availableTeams',(select coalesce(jsonb_agg(jsonb_build_object('slug',t.slug,'name',t.name) order by t.name),'[]') from public.team_memberships tm join public.teams t on t.slug=tm.team_slug where tm.user_id=u.id and tm.active)),
    'cloudStorage', jsonb_build_object('provider','Supabase','configured',true,'mode','prepared')
  );
end $$;

create or replace function public.cup_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u public.app_users := public.claim_app_user(); team_slug_value text := public.current_team_slug();
begin
  return jsonb_build_object(
    'cups',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'startDate',c.start_date,'endDate',c.end_date,'venue',c.venue,'periodCount',c.period_count,'periodMinutes',c.period_minutes,'createdAt',c.created_at) order by c.start_date,c.name),'[]') from public.cups c where c.team_slug=team_slug_value),
    'cupTeams',(select coalesce(jsonb_agg(jsonb_build_object('id',ct.id,'cupId',ct.cup_id,'name',ct.name,'sortOrder',ct.sort_order) order by ct.cup_id,ct.sort_order,ct.id),'[]') from public.cup_teams ct join public.cups c on c.id=ct.cup_id where c.team_slug=team_slug_value),
    'cupTeamPlayers',(select coalesce(jsonb_agg(jsonb_build_object('cupId',ctp.cup_id,'cupTeamId',ctp.cup_team_id,'playerId',ctp.player_id) order by ctp.cup_id,ctp.cup_team_id,ctp.player_id),'[]') from public.cup_team_players ctp join public.cups c on c.id=ctp.cup_id where c.team_slug=team_slug_value),
    'playerGuardians',case when u.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('playerId',pg.player_id,'userId',pg.user_id) order by pg.player_id,pg.user_id),'[]') from public.player_guardians pg join public.players p on p.id=pg.player_id where p.team_slug=team_slug_value) else '[]'::jsonb end,
    'cupMatchLinks',(select coalesce(jsonb_agg(jsonb_build_object('matchId',m.id,'cupId',m.cup_id,'cupTeamId',m.cup_team_id) order by m.cup_id,m.date,m.start_time,m.id),'[]') from public.matches m where m.team_slug=team_slug_value and m.cup_id is not null)
  );
end $$;

create or replace function public.live_match_snapshot(match_id_input bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u public.app_users := public.claim_app_user(); result jsonb; team_slug_value text := public.current_team_slug();
begin
  if not exists(select 1 from public.matches where id=match_id_input and team_slug=team_slug_value) then raise exception 'Kampen finnes ikke.'; end if;
  select jsonb_build_object(
    'match',jsonb_build_object('id',m.id,'date',m.date,'startTime',m.start_time,'opponent',m.opponent,'team',m.team,'homeAway',m.home_away,'competition',m.competition,'matchType',m.match_type,'cupName',m.cup_name,'venue',m.venue,'registrarName',(select au.name from public.match_registrars mr join public.app_users au on au.id=mr.user_id where mr.match_id=m.id order by au.name limit 1),'ourScore',m.our_score,'opponentScore',m.opponent_score,'periodCount',m.period_count,'periodMinutes',m.period_minutes,'matchPhase',m.match_phase,'currentPeriod',m.current_period,'periodElapsedSeconds',m.period_elapsed_seconds,'clockStartedAt',m.clock_started_at,'elapsedSeconds',m.elapsed_seconds,'clockRunning',m.clock_running,'notes',case when u.role='admin' or exists(select 1 from public.match_registrars mr where mr.match_id=m.id and mr.user_id=u.id) then m.notes else '' end,'status',m.status,'completedAt',m.completed_at,'createdAt',m.created_at),
    'matchPlayers',(select coalesce(jsonb_agg(jsonb_build_object('matchId',mp.match_id,'playerId',mp.player_id,'starter',mp.starter,'goalkeeper',mp.goalkeeper,'captain',mp.captain,'position',mp.position,'teamSide',mp.team_side) order by mp.player_id),'[]') from public.match_players mp where mp.match_id=m.id),
    'matchEvents',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'matchId',e.match_id,'playerId',e.player_id,'side',e.side,'type',e.type,'matchSecond',e.match_second,'period',e.period,'periodSecond',e.period_second,'annulled',e.annulled,'createdAt',e.created_at) order by e.id desc),'[]') from public.match_events e where e.match_id=m.id),
    'matchSubstitutions',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'matchId',s.match_id,'playerInId',s.player_in_id,'playerOutId',s.player_out_id,'position',s.position,'swap',s.swap,'playerInPreviousPosition',s.player_in_previous_position,'matchSecond',s.match_second,'period',s.period,'periodSecond',s.period_second,'createdAt',s.created_at) order by s.id),'[]') from public.match_substitutions s where s.match_id=m.id)
  ) into result from public.matches m where m.id=match_id_input and m.team_slug=team_slug_value;
  return result;
end $$;

create or replace function public.match_enhancements_snapshot(match_id_input bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u public.app_users := public.claim_app_user(); team_slug_value text := public.current_team_slug();
begin
  if match_id_input is not null and not exists(select 1 from public.matches where id=match_id_input and team_slug=team_slug_value) then raise exception 'Kampen finnes ikke.'; end if;
  return jsonb_build_object(
    'matchEvents',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'matchId',e.match_id,'playerId',e.player_id,'side',e.side,'type',e.type,'matchSecond',e.match_second,'period',e.period,'periodSecond',e.period_second,'annulled',e.annulled,'annulledAt',e.annulled_at,'createdAt',e.created_at) order by e.id desc),'[]') from public.match_events e join public.matches m on m.id=e.match_id where m.team_slug=team_slug_value and (match_id_input is null or e.match_id=match_id_input)),
    'matchSubstitutions',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'matchId',s.match_id,'playerInId',s.player_in_id,'playerOutId',s.player_out_id,'position',s.position,'swap',s.swap,'playerInPreviousPosition',s.player_in_previous_position,'matchSecond',s.match_second,'period',s.period,'periodSecond',s.period_second,'createdAt',s.created_at) order by s.id),'[]') from public.match_substitutions s join public.matches m on m.id=s.match_id where m.team_slug=team_slug_value and (match_id_input is null or s.match_id=match_id_input)),
    'matchComments',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'matchId',c.match_id,'visibility',c.visibility,'body',c.body,'authorName',au.name,'createdAt',c.created_at) order by c.created_at desc,c.id desc),'[]') from public.match_comments c join public.matches m on m.id=c.match_id join public.app_users au on au.id=c.author_user_id where m.team_slug=team_slug_value and (match_id_input is null or c.match_id=match_id_input) and (c.visibility='public' or u.role='admin' or exists(select 1 from public.match_registrars mr where mr.match_id=c.match_id and mr.user_id=u.id)))
  );
end $$;

create or replace function public.training_observations_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u public.app_users := public.claim_app_user(); team_slug_value text := public.current_team_slug();
begin
  perform public.require_admin(u);
  return (select coalesce(jsonb_agg(jsonb_build_object('trainingId',o.training_id,'playerId',o.player_id,'positiveCount',o.positive_count,'positiveTags',o.positive_tags,'concern',o.concern,'needsFollowUp',o.needs_follow_up,'note',o.note,'spokenTo',o.spoken_to,'updatedAt',o.updated_at) order by o.training_id,o.player_id),'[]') from public.training_observations o join public.trainings t on t.id=o.training_id where t.team_slug=team_slug_value);
end $$;

create or replace function public.user_login_activity()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u public.app_users := public.claim_app_user();
  team_slug_value text := public.current_team_slug();
  current_session_id uuid := nullif(auth.jwt()->>'session_id','')::uuid;
begin
  if current_session_id is not null then insert into public.user_login_sessions(session_id,app_user_id,team_slug) values(current_session_id,u.id,team_slug_value) on conflict(session_id,team_slug) do nothing; end if;
  if u.role<>'admin' then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('userId',au.id,'loginCount',coalesce(activity.login_count,0),'lastLoginAt',greatest(activity.last_login_at,auth_user.last_sign_in_at)) order by au.name),'[]')
    from public.app_users au join public.team_memberships tm on tm.user_id=au.id and tm.team_slug=team_slug_value
    left join (select app_user_id,count(*)::bigint login_count,max(signed_in_at) last_login_at from public.user_login_sessions where team_slug=team_slug_value group by app_user_id) activity on activity.app_user_id=au.id
    left join auth.users auth_user on auth_user.id=au.account_user_id where tm.active);
end $$;

revoke all on function public.claim_app_user() from public,anon;
revoke all on function public.current_team_slug() from public,anon,authenticated;
revoke all on function public.guard_team_data() from public,anon,authenticated;
revoke all on function public.ensure_user_team_membership() from public,anon,authenticated;
revoke all on function public.delete_user_from_current_team() from public,anon,authenticated;
grant execute on function public.claim_app_user() to authenticated;
grant execute on function public.season_snapshot() to authenticated;
grant execute on function public.cup_snapshot() to authenticated;
grant execute on function public.live_match_snapshot(bigint) to authenticated;
grant execute on function public.match_enhancements_snapshot(bigint) to authenticated;
grant execute on function public.training_observations_snapshot() to authenticated;
grant execute on function public.user_login_activity() to authenticated;

commit;
