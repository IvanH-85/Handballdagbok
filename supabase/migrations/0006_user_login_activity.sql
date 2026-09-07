begin;

create table public.user_login_sessions (
  session_id uuid primary key,
  app_user_id bigint not null references public.app_users(id) on delete cascade,
  signed_in_at timestamptz not null default now()
);
create index user_login_sessions_app_user_idx on public.user_login_sessions(app_user_id, signed_in_at desc);

alter table public.user_login_sessions enable row level security;
revoke all on table public.user_login_sessions from public, anon, authenticated, service_role;

-- Preserve active sessions that already existed when tracking was enabled.
insert into public.user_login_sessions(session_id, app_user_id, signed_in_at)
select s.id, u.id, s.created_at
from auth.sessions s
join public.app_users u on u.account_user_id = s.user_id
on conflict (session_id) do nothing;

create or replace function public.user_login_activity()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  u public.app_users := public.claim_app_user();
  current_session_id uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
begin
  if current_session_id is not null then
    insert into public.user_login_sessions(session_id, app_user_id)
    values (current_session_id, u.id)
    on conflict (session_id) do nothing;
  end if;

  if u.role <> 'admin' then
    return '[]'::jsonb;
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'userId', app_user.id,
      'loginCount', coalesce(activity.login_count, 0),
      'lastLoginAt', greatest(activity.last_login_at, auth_user.last_sign_in_at)
    ) order by app_user.name), '[]'::jsonb)
    from public.app_users app_user
    left join (
      select app_user_id, count(*)::bigint as login_count, max(signed_in_at) as last_login_at
      from public.user_login_sessions
      group by app_user_id
    ) activity on activity.app_user_id = app_user.id
    left join auth.users auth_user on auth_user.id = app_user.account_user_id
  );
end;
$$;

revoke all on function public.user_login_activity() from public, anon;
grant execute on function public.user_login_activity() to authenticated;

commit;
