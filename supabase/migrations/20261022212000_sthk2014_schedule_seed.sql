begin;

select set_config('app.active_team_slug','sthk2014',true);

alter table public.matches add column if not exists source_match_key text;
alter table public.trainings add column if not exists source_key text;
create unique index if not exists matches_source_match_key_uidx on public.matches(source_match_key) where source_match_key is not null;
create unique index if not exists trainings_source_key_uidx on public.trainings(source_key) where source_key is not null;

insert into public.matches(source_match_key,date,start_time,opponent,team,home_away,competition,match_type,venue,our_score,opponent_score,period_count,period_minutes,match_phase,current_period,period_elapsed_seconds,elapsed_seconds,clock_running,status,completed_at)
values
  ('handballno:8420731','2026-09-19'::date,'11:00','Svolvær 3','Stokmarknes Idrettslag','away','J12 NordNorge-serien - 02 2026/27','league','Våganhallen',15,8,2,20,'completed',2,1200,2400,false,'completed',(('2026-09-19'::date + '11:00'::time) at time zone 'Europe/Oslo')),
  ('handballno:8420743','2026-09-19'::date,'13:30','Svolvær 2','Stokmarknes Idrettslag','away','J12 NordNorge-serien - 02 2026/27','league','Våganhallen',16,1,2,20,'completed',2,1200,2400,false,'completed',(('2026-09-19'::date + '13:30'::time) at time zone 'Europe/Oslo')),
  ('handballno:8420704','2026-09-20'::date,'11:00','Svolvær','Stokmarknes Idrettslag','away','J12 NordNorge-serien - 02 2026/27','league','Våganhallen',17,15,2,20,'completed',2,1200,2400,false,'completed',(('2026-09-20'::date + '11:00'::time) at time zone 'Europe/Oslo')),
  ('handballno:8420694','2026-11-08'::date,'16:00','Andøy HK','Stokmarknes Idrettslag','home','J12 NordNorge-serien - 02 2026/27','league','Hadselhallen',null,null,2,20,'pre_match',0,0,0,false,'planned',null),
  ('handballno:8420749','2026-12-05'::date,'12:00','Andøy HK','Stokmarknes Idrettslag','away','J12 NordNorge-serien - 02 2026/27','league','Andeneshallen',null,null,2,20,'pre_match',0,0,0,false,'planned',null),
  ('handballno:8420683','2027-01-16'::date,'11:00','Svolvær 2','Stokmarknes Idrettslag','home','J12 NordNorge-serien - 02 2026/27','league','Hadselhallen',null,null,2,20,'pre_match',0,0,0,false,'planned',null),
  ('handballno:8420759','2027-01-17'::date,'11:00','Svolvær','Stokmarknes Idrettslag','home','J12 NordNorge-serien - 02 2026/27','league','Hadselhallen',null,null,2,20,'pre_match',0,0,0,false,'planned',null),
  ('handballno:8420786','2027-01-17'::date,'15:00','Svolvær 3','Stokmarknes Idrettslag','home','J12 NordNorge-serien - 02 2026/27','league','Hadselhallen',null,null,2,20,'pre_match',0,0,0,false,'planned',null),
  ('handballno:8420760','2027-01-26'::date,'17:00','Sortland','Stokmarknes Idrettslag','away','J12 NordNorge-serien - 02 2026/27','league','Sortlandshallen',null,null,2,20,'pre_match',0,0,0,false,'planned',null),
  ('handballno:8420777','2027-02-06'::date,'09:30','Stokmarknes Idrettslag 3','Stokmarknes Idrettslag','home','J12 NordNorge-serien - 02 2026/27','league','Hadselhallen',null,null,2,20,'pre_match',0,0,0,false,'planned',null),
  ('handballno:8420705','2027-02-06'::date,'11:00','Sortland','Stokmarknes Idrettslag','home','J12 NordNorge-serien - 02 2026/27','league','Hadselhallen',null,null,2,20,'pre_match',0,0,0,false,'planned',null),
  ('handballno:8420782','2027-02-07'::date,'10:00','Stokmarknes Idrettslag 2','Stokmarknes Idrettslag','away','J12 NordNorge-serien - 02 2026/27','league','Hadselhallen',null,null,2,20,'pre_match',0,0,0,false,'planned',null),
  ('handballno:8420722','2027-02-07'::date,'11:30','Stokmarknes Idrettslag 3','Stokmarknes Idrettslag','away','J12 NordNorge-serien - 02 2026/27','league','Hadselhallen',null,null,2,20,'pre_match',0,0,0,false,'planned',null),
  ('handballno:8420727','2027-02-07'::date,'13:00','Stokmarknes Idrettslag 2','Stokmarknes Idrettslag','home','J12 NordNorge-serien - 02 2026/27','league','Hadselhallen',null,null,2,20,'pre_match',0,0,0,false,'planned',null),
  ('handballno:8420768','2027-02-13'::date,'17:00','Kabelvåg','Stokmarknes Idrettslag','home','J12 NordNorge-serien - 02 2026/27','league','Hadselhallen',null,null,2,20,'pre_match',0,0,0,false,'planned',null),
  ('handballno:8420716','2027-03-14'::date,'10:00','Leknes','Stokmarknes Idrettslag','home','J12 NordNorge-serien - 02 2026/27','league','Hadselhallen',null,null,2,20,'pre_match',0,0,0,false,'planned',null),
  ('handballno:8420735','2027-03-14'::date,'16:00','Leknes 2','Stokmarknes Idrettslag','home','J12 NordNorge-serien - 02 2026/27','league','Hadselhallen',null,null,2,20,'pre_match',0,0,0,false,'planned',null),
  ('handballno:8420771','2027-04-03'::date,'10:00','Leknes','Stokmarknes Idrettslag','away','J12 NordNorge-serien - 02 2026/27','league','Leknes 74 hallen',null,null,2,20,'pre_match',0,0,0,false,'planned',null),
  ('handballno:8420685','2027-04-03'::date,'15:00','Leknes 2','Stokmarknes Idrettslag','away','J12 NordNorge-serien - 02 2026/27','league','Leknes 74 hallen',null,null,2,20,'pre_match',0,0,0,false,'planned',null),
  ('handballno:8420713','2027-04-03'::date,'18:00','Kabelvåg','Stokmarknes Idrettslag','away','J12 NordNorge-serien - 02 2026/27','league','Polarkrafthallen flerbrukshall',null,null,2,20,'pre_match',0,0,0,false,'planned',null)
on conflict (source_match_key) where source_match_key is not null do update set date=excluded.date,start_time=excluded.start_time,opponent=excluded.opponent,team=excluded.team,home_away=excluded.home_away,competition=excluded.competition,match_type=excluded.match_type,venue=excluded.venue,our_score=excluded.our_score,opponent_score=excluded.opponent_score,period_count=excluded.period_count,period_minutes=excluded.period_minutes,match_phase=excluded.match_phase,current_period=excluded.current_period,period_elapsed_seconds=excluded.period_elapsed_seconds,elapsed_seconds=excluded.elapsed_seconds,clock_running=excluded.clock_running,status=excluded.status,completed_at=excluded.completed_at;

-- 58 future sessions, following Hadsel kommune skolerute 2026/27; school holidays are omitted.
with candidate_dates as (select session_date::date as session_date from generate_series('2026-10-26'::date,'2027-06-18'::date,interval '1 day') as days(session_date)), sessions as (select session_date, case when extract(isodow from session_date)=1 then '18:00' else '19:00' end as start_time, case when extract(isodow from session_date)=1 then 90 else 60 end as duration_minutes from candidate_dates where extract(isodow from session_date) in (1,3) and session_date not between '2026-12-21' and '2027-01-03' and session_date not between '2027-02-22' and '2027-02-26' and session_date not between '2027-03-22' and '2027-03-29' and session_date <> '2027-05-17')
insert into public.trainings(source_key,date,start_time,duration_minutes,title,status)
select 'sthk2014-training:'||session_date::text,session_date,start_time,duration_minutes,'Lagstrening','planned' from sessions
on conflict (source_key) where source_key is not null do update set date=excluded.date,start_time=excluded.start_time,duration_minutes=excluded.duration_minutes,title=excluded.title,status=excluded.status;

commit;

-- Source: NHF Kampsøk, Stokmarknes Idrettslag J12 team 1033568, tournament 447972.
-- School calendar: Hadsel kommune 2025-2028 school route, 2026/27.
