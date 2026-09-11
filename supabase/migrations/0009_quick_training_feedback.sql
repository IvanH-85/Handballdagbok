begin;

alter table public.training_observations
  add column if not exists positive_tags text[] not null default '{}'::text[],
  add column if not exists concern boolean not null default false;

update public.training_observations
set positive_tags = case when positive_count > 0 then array['good_effort']::text[] else positive_tags end,
    concern = case when needs_follow_up and positive_count = 0 and note = '' then true else concern end
where positive_tags = '{}'::text[] and not concern;

alter table public.training_observations
  drop constraint if exists training_observations_positive_tags_check;
alter table public.training_observations
  add constraint training_observations_positive_tags_check check (
    positive_tags <@ array['good_pass','good_shot','read_situation','good_defense','good_effort']::text[]
  );

create or replace function public.training_observations_snapshot()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  u public.app_users := public.claim_app_user();
begin
  perform public.require_admin(u);
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'trainingId', training_id,
      'playerId', player_id,
      'positiveCount', positive_count,
      'positiveTags', positive_tags,
      'concern', concern,
      'needsFollowUp', needs_follow_up,
      'note', note,
      'spokenTo', spoken_to,
      'updatedAt', updated_at
    ) order by training_id, player_id), '[]'::jsonb)
    from public.training_observations
  );
end;
$$;

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

  if cardinality(tags_value) = 0 and not concern_value then
    delete from public.training_observations where training_id = tid and player_id = pid;
  else
    insert into public.training_observations(training_id, player_id, positive_count, positive_tags, concern, needs_follow_up, note, spoken_to, updated_by, updated_at)
    values (tid, pid, 0, tags_value, concern_value, true, '', spoken_value, u.id, now())
    on conflict (training_id, player_id) do update set
      positive_count = 0,
      positive_tags = excluded.positive_tags,
      concern = excluded.concern,
      needs_follow_up = true,
      note = '',
      spoken_to = excluded.spoken_to,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;
  end if;

  return '{"ok":true}'::jsonb;
end;
$$;

revoke all on function public.training_observations_snapshot() from public, anon;
revoke all on function public.save_training_observation(jsonb) from public, anon;
grant execute on function public.training_observations_snapshot() to authenticated;
grant execute on function public.save_training_observation(jsonb) to authenticated;

commit;
