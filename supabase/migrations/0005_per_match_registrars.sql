begin;

-- A match registrar is an ordinary parent who is assigned to one match.
update public.app_users
set role = 'parent'
where role = 'match_registrar';

create or replace function public.require_editable_match(u public.app_users, target_match bigint)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare m public.matches;
begin
  if u.role <> 'admin' and not exists (
    select 1
    from public.match_registrars
    where match_id = target_match and user_id = u.id
  ) then
    raise exception 'Du har ikke tilgang til å registrere denne kampen.' using errcode='42501';
  end if;
  select * into m from public.matches where id=target_match;
  if m.id is null then raise exception 'Kampen finnes ikke.'; end if;
  if m.status in ('completed','cancelled') then raise exception 'Kampen er låst. En administrator må åpne den igjen.'; end if;
  return m;
end $$;

-- Keep the existing action implementation, but allow active parents to be
-- assigned by an administrator when a match is saved.
do $migration$
declare
  old_definition text;
  new_definition text;
begin
  select pg_get_functiondef(p.oid)
    into old_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'season_action'
    and pg_get_function_identity_arguments(p.oid) = 'payload jsonb';

  new_definition := replace(
    old_definition,
    'and role=''match_registrar'' and active',
    'and role in (''parent'',''match_registrar'') and active'
  );

  if old_definition is null or new_definition = old_definition then
    raise exception 'Kunne ikke oppdatere valg av kampregistrator.';
  end if;

  execute new_definition;
end
$migration$;

create or replace function public.season_snapshot()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  u public.app_users := public.claim_app_user();
  match_ids bigint[];
begin
  select coalesce(array_agg(id), array[]::bigint[]) into match_ids from public.matches;

  return jsonb_build_object(
    'players', case when u.role = 'admin' then
      (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'jerseyNumber',jersey_number,'shirtSize',shirt_size,'shortsSize',shorts_size,'active',active,'createdAt',created_at) order by active desc, jersey_number, name),'[]') from public.players)
      else (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'jerseyNumber',jersey_number,'shirtSize','','shortsSize','','active',active,'createdAt',created_at) order by active desc, jersey_number, name),'[]') from public.players) end,
    'trainings', case when u.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'date',date,'startTime',start_time,'durationMinutes',duration_minutes,'title',title,'theme',theme,'plan',plan,'notes',notes,'status',status,'completedAt',completed_at,'createdAt',created_at) order by date desc,start_time desc),'[]') from public.trainings) else '[]'::jsonb end,
    'attendance', case when u.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('trainingId',training_id,'playerId',player_id)),'[]') from public.training_attendance) else '[]'::jsonb end,
    'exercises', case when u.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'seedKey',seed_key,'title',title,'category',category,'description',description,'durationMinutes',duration_minutes,'equipment',equipment,'sourceTitle',source_title,'sourceUrl',source_url,'createdAt',created_at) order by category,title),'[]') from public.exercises) else '[]'::jsonb end,
    'trainingExercises', case when u.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'trainingId',training_id,'exerciseId',exercise_id,'section',section,'sortOrder',sort_order,'durationMinutes',duration_minutes,'notes',notes) order by training_id,section,sort_order,id),'[]') from public.training_exercises) else '[]'::jsonb end,
    'matches', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'date',date,'startTime',start_time,'opponent',opponent,'team',team,'homeAway',home_away,'competition',competition,'matchType',match_type,'cupName',cup_name,'venue',venue,'ourScore',our_score,'opponentScore',opponent_score,'periodCount',period_count,'periodMinutes',period_minutes,'matchPhase',match_phase,'currentPeriod',current_period,'periodElapsedSeconds',period_elapsed_seconds,'clockStartedAt',clock_started_at,'elapsedSeconds',elapsed_seconds,'clockRunning',clock_running,'notes',case when u.role='admin' or exists(select 1 from public.match_registrars mr where mr.match_id=matches.id and mr.user_id=u.id) then notes else '' end,'status',status,'completedAt',completed_at,'createdAt',created_at) order by date,start_time),'[]') from public.matches where id=any(match_ids)),
    'matchPlayers', (select coalesce(jsonb_agg(jsonb_build_object('matchId',match_id,'playerId',player_id,'starter',starter,'goalkeeper',goalkeeper,'captain',captain,'position',position)),'[]') from public.match_players where match_id=any(match_ids)),
    'matchEvents', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'matchId',match_id,'playerId',player_id,'side',side,'type',type,'matchSecond',match_second,'period',period,'periodSecond',period_second,'createdAt',created_at) order by id desc),'[]') from public.match_events where match_id=any(match_ids)),
    'matchSubstitutions', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'matchId',match_id,'playerInId',player_in_id,'playerOutId',player_out_id,'position',position,'matchSecond',match_second,'period',period,'periodSecond',period_second,'createdAt',created_at) order by id),'[]') from public.match_substitutions where match_id=any(match_ids)),
    'appUsers', case when u.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'email',email,'phone',phone,'role',role,'active',active,'accountUserId',account_user_id,'createdAt',created_at) order by role,name),'[]') from public.app_users) else '[]'::jsonb end,
    'matchRegistrars', case when u.role='admin' then
      (select coalesce(jsonb_agg(jsonb_build_object('matchId',match_id,'userId',user_id)),'[]') from public.match_registrars)
      else (select coalesce(jsonb_agg(jsonb_build_object('matchId',match_id,'userId',user_id)),'[]') from public.match_registrars where user_id=u.id) end,
    'currentUser', jsonb_build_object('id',u.id,'name',u.name,'email',u.email,'role',u.role),
    'cloudStorage', jsonb_build_object('provider','Supabase','configured',true,'mode','prepared')
  );
end;
$$;

revoke all on function public.require_editable_match(public.app_users,bigint) from public,anon,authenticated;
revoke all on function public.season_snapshot() from public,anon;
grant execute on function public.season_snapshot() to authenticated;

commit;
