create or replace function app_private.complete_single_period_match()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  if new.period_count = 1 and new.match_phase = 'halftime' then
    new.match_phase := 'completed';
    new.status := 'completed';
    new.completed_at := coalesce(new.completed_at, now());
    new.current_period := 1;
    new.clock_running := false;
    new.clock_started_at := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists complete_single_period_match_trigger on public.matches;
create trigger complete_single_period_match_trigger
before insert or update of period_count, match_phase on public.matches
for each row
execute function app_private.complete_single_period_match();

update public.matches
set match_phase='completed',
    status='completed',
    completed_at=coalesce(completed_at,now()),
    current_period=1,
    clock_running=false,
    clock_started_at=null
where period_count=1 and match_phase='halftime';
