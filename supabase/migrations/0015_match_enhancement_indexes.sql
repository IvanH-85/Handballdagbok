begin;

create index if not exists match_comments_author_idx on public.match_comments(author_user_id);
create index if not exists match_events_annulled_by_idx on public.match_events(annulled_by) where annulled_by is not null;

commit;
