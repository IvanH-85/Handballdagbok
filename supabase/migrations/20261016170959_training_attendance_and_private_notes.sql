begin;

alter table public.trainings
  add column if not exists attendance_recorded boolean not null default false;

update public.trainings t
set attendance_recorded = true
where exists (
  select 1 from public.training_attendance a where a.training_id = t.id
);

do $migration$
declare
  snapshot_def text;
  action_def text;
  old_text text;
  new_text text;
begin
  select pg_get_functiondef('public.season_snapshot()'::regprocedure) into snapshot_def;
  old_text := $old$'notes',notes,'status',status,'completedAt',completed_at$old$;
  new_text := $new$'notes',notes,'attendanceRecorded',attendance_recorded,'status',status,'completedAt',completed_at$new$;
  if position(old_text in snapshot_def) = 0 then
    raise exception 'Could not locate training JSON fields in season_snapshot';
  end if;
  execute replace(snapshot_def, old_text, new_text);

  select pg_get_functiondef('public.season_action(jsonb)'::regprocedure) into action_def;
  old_text := $old$insert into public.trainings(date,start_time,duration_minutes,title,theme,plan,notes)
      values ((payload->>'date')::date,btrim(coalesce(payload->>'startTime','')),greatest(1,coalesce((payload->>'durationMinutes')::integer,60)),coalesce(nullif(btrim(payload->>'title'),''),'Lagstrening'),btrim(coalesce(payload->>'theme','')),btrim(coalesce(payload->>'plan','')),btrim(coalesce(payload->>'notes',''))) returning id into tid;$old$;
  new_text := $new$insert into public.trainings(date,start_time,duration_minutes,title,theme,plan,notes,attendance_recorded)
      values ((payload->>'date')::date,btrim(coalesce(payload->>'startTime','')),greatest(1,coalesce((payload->>'durationMinutes')::integer,60)),coalesce(nullif(btrim(payload->>'title'),''),'Lagstrening'),btrim(coalesce(payload->>'theme','')),btrim(coalesce(payload->>'plan','')),btrim(coalesce(payload->>'notes','')),coalesce((payload->>'attendanceRecorded')::boolean,false)) returning id into tid;$new$;
  if position(old_text in action_def) = 0 then
    raise exception 'Could not locate training insert in season_action';
  end if;
  action_def := replace(action_def, old_text, new_text);

  old_text := $old$update public.trainings set date=(payload->>'date')::date,start_time=btrim(coalesce(payload->>'startTime','')),duration_minutes=greatest(1,coalesce((payload->>'durationMinutes')::integer,60)),title=coalesce(nullif(btrim(payload->>'title'),''),'Lagstrening'),theme=btrim(coalesce(payload->>'theme','')),plan=btrim(coalesce(payload->>'plan','')),notes=btrim(coalesce(payload->>'notes','')) where id=tid;$old$;
  new_text := $new$update public.trainings set date=(payload->>'date')::date,start_time=btrim(coalesce(payload->>'startTime','')),duration_minutes=greatest(1,coalesce((payload->>'durationMinutes')::integer,60)),title=coalesce(nullif(btrim(payload->>'title'),''),'Lagstrening'),theme=btrim(coalesce(payload->>'theme','')),plan=btrim(coalesce(payload->>'plan','')),notes=btrim(coalesce(payload->>'notes','')),attendance_recorded=coalesce((payload->>'attendanceRecorded')::boolean,false) where id=tid;$new$;
  if position(old_text in action_def) = 0 then
    raise exception 'Could not locate training update in season_action';
  end if;
  execute replace(action_def, old_text, new_text);
end;
$migration$;

create or replace function public.save_training_observation(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  u public.app_users := public.claim_app_user();
  tid bigint := nullif(payload->>'trainingId', '')::bigint;
  pid bigint := nullif(payload->>'playerId', '')::bigint;
  tags_value text[];
  concern_value boolean := coalesce((payload->>'concern')::boolean, false);
  spoken_value boolean := coalesce((payload->>'spokenTo')::boolean, false);
  note_value text := left(btrim(coalesce(payload->>'note', '')), 500);
  follow_up_value boolean;
begin
  perform public.require_admin(u);
  select coalesce(array_agg(tag_value order by tag_value), '{}'::text[])
  into tags_value
  from (
    select distinct value as tag_value
    from jsonb_array_elements_text(coalesce(payload->'positiveTags', '[]'::jsonb))
    where value in ('good_pass','good_shot','read_situation','good_defense','good_effort')
  ) allowed_tags;

  if tid is null or pid is null or not exists (
    select 1 from public.training_attendance
    where training_id = tid and player_id = pid
  ) then
    raise exception 'Spilleren er ikke registrert på denne treningen.';
  end if;
  if exists (select 1 from public.trainings where id = tid and status = 'cancelled') then
    raise exception 'Du kan ikke lagre observasjoner på en avlyst trening.';
  end if;

  follow_up_value := cardinality(tags_value) > 0 or concern_value;
  if not follow_up_value and note_value = '' then
    delete from public.training_observations where training_id = tid and player_id = pid;
  else
    insert into public.training_observations(training_id, player_id, positive_count, positive_tags, concern, needs_follow_up, note, spoken_to, updated_by, updated_at)
    values (tid, pid, 0, tags_value, concern_value, follow_up_value, note_value, spoken_value, u.id, now())
    on conflict (training_id, player_id) do update set
      positive_count = 0,
      positive_tags = excluded.positive_tags,
      concern = excluded.concern,
      needs_follow_up = excluded.needs_follow_up,
      note = excluded.note,
      spoken_to = excluded.spoken_to,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;
  end if;

  return '{"ok":true}'::jsonb;
end;
$$;

revoke all on function public.save_training_observation(jsonb) from public, anon;
grant execute on function public.save_training_observation(jsonb) to authenticated;

commit;
