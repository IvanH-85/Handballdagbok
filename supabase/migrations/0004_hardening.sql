begin;

-- Internal helper: browser users only call season_snapshot and season_action.
revoke all on function public.claim_app_user() from authenticated;

-- Cover foreign keys used by cascades, roster lookups and imports.
create index if not exists match_events_player_idx on public.match_events(player_id);
create index if not exists match_players_player_idx on public.match_players(player_id);
create index if not exists match_substitutions_player_in_idx on public.match_substitutions(player_in_id);
create index if not exists match_substitutions_player_out_idx on public.match_substitutions(player_out_id);
create index if not exists training_attendance_player_idx on public.training_attendance(player_id);
create index if not exists training_exercises_training_idx on public.training_exercises(training_id);
create index if not exists training_exercises_exercise_idx on public.training_exercises(exercise_id);

commit;
