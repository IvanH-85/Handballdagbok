begin;

create table if not exists public.training_observations (
  training_id bigint not null references public.trainings(id) on delete cascade,
  player_id bigint not null references public.players(id) on delete cascade,
  positive_count smallint not null default 0 check (positive_count between 0 and 99),
  needs_follow_up boolean not null default false,
  note text not null default '' check (char_length(note) <= 500),
  spoken_to boolean not null default false,
  updated_by bigint references public.app_users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (training_id, player_id)
);

alter table public.training_observations enable row level security;
revoke all on table public.training_observations from public, anon, authenticated;
create index if not exists training_observations_player_idx on public.training_observations(player_id);
create index if not exists training_observations_updated_by_idx on public.training_observations(updated_by);

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
  positive_value integer := greatest(0, least(99, coalesce((payload->>'positiveCount')::integer, 0)));
  follow_up_value boolean := coalesce((payload->>'needsFollowUp')::boolean, false);
  spoken_value boolean := coalesce((payload->>'spokenTo')::boolean, false);
  note_value text := left(btrim(coalesce(payload->>'note', '')), 500);
begin
  perform public.require_admin(u);
  if tid is null or pid is null or not exists (
    select 1 from public.training_attendance
    where training_id = tid and player_id = pid
  ) then
    raise exception 'Spilleren er ikke registrert på denne treningen.';
  end if;
  if exists (select 1 from public.trainings where id = tid and status = 'cancelled') then
    raise exception 'Du kan ikke lagre observasjoner på en avlyst trening.';
  end if;

  if positive_value = 0 and not follow_up_value and not spoken_value and note_value = '' then
    delete from public.training_observations where training_id = tid and player_id = pid;
  else
    insert into public.training_observations(training_id, player_id, positive_count, needs_follow_up, note, spoken_to, updated_by, updated_at)
    values (tid, pid, positive_value, follow_up_value, note_value, spoken_value, u.id, now())
    on conflict (training_id, player_id) do update set
      positive_count = excluded.positive_count,
      needs_follow_up = excluded.needs_follow_up,
      note = excluded.note,
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
