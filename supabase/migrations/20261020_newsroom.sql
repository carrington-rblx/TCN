-- TCN Newsroom schema. Apply in the Supabase SQL editor or via Supabase migrations.
create extension if not exists pgcrypto;

create table if not exists public.newsroom_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);
alter table public.newsroom_profiles enable row level security;

create table if not exists public.newsroom_articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  headline text not null check (char_length(headline) between 1 and 180),
  category text not null default 'Top Stories',
  summary text not null default '' check (char_length(summary) <= 500),
  body text not null,
  byline text not null default '',
  image_url text,
  status text not null default 'draft' check (status in ('draft','submitted','revision_requested','approved','rejected')),
  editor_note text not null default '',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists newsroom_articles_author_updated_idx on public.newsroom_articles(author_id, updated_at desc);
create index if not exists newsroom_articles_publish_idx on public.newsroom_articles(status, approved_at desc);
alter table public.newsroom_articles enable row level security;

create table if not exists public.newsroom_elections (
  id uuid primary key default gen_random_uuid(),
  editor_id uuid not null references auth.users(id),
  title text not null check (char_length(title) between 1 and 180),
  election_type text not null default 'Other',
  party_or_jurisdiction text not null default '',
  election_date date,
  counting_status text not null default 'Results coming in',
  candidates jsonb not null default '[]'::jsonb check (jsonb_typeof(candidates) = 'array'),
  notes text not null default '',
  publication_status text not null default 'draft' check (publication_status in ('draft','published')),
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists newsroom_elections_published_idx on public.newsroom_elections(publication_status, updated_at desc);
alter table public.newsroom_elections enable row level security;

-- Role authorization comes from auth.app_metadata, which users cannot edit themselves.
-- Editors are provisioned by the project owner through Supabase Auth / SQL; do not use user_metadata for roles.
create or replace function public.tcn_is_editor()
returns boolean language sql stable security invoker
as $$ select coalesce(auth.jwt()->'app_metadata'->>'role' in ('editor','admin'), false) $$;

create policy "profile self or editor read" on public.newsroom_profiles for select to authenticated
using (id = (select auth.uid()) or (select public.tcn_is_editor()));
create policy "profile self insert" on public.newsroom_profiles for insert to authenticated
with check (id = (select auth.uid()));
create policy "profile self update display name" on public.newsroom_profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "authors read own articles editors read all" on public.newsroom_articles for select to authenticated
using (author_id = (select auth.uid()) or (select public.tcn_is_editor()));
create policy "authors create own drafts" on public.newsroom_articles for insert to authenticated
with check (author_id = (select auth.uid()) and status in ('draft','submitted'));
create policy "authors update own unapproved articles" on public.newsroom_articles for update to authenticated
using (author_id = (select auth.uid()) and status in ('draft','revision_requested'))
with check (author_id = (select auth.uid()) and status in ('draft','submitted','revision_requested'));
create policy "editors update any article" on public.newsroom_articles for update to authenticated
using ((select public.tcn_is_editor())) with check ((select public.tcn_is_editor()));
create policy "editors delete articles" on public.newsroom_articles for delete to authenticated
using ((select public.tcn_is_editor()));

create policy "editors read election results" on public.newsroom_elections for select to authenticated
using ((select public.tcn_is_editor()));
create policy "authors read published election results" on public.newsroom_elections for select to authenticated
using (publication_status = 'published');
create policy "editors create election results" on public.newsroom_elections for insert to authenticated
with check ((select public.tcn_is_editor()) and editor_id = (select auth.uid()));
create policy "editors update election results" on public.newsroom_elections for update to authenticated
using ((select public.tcn_is_editor())) with check ((select public.tcn_is_editor()));
create policy "editors delete election results" on public.newsroom_elections for delete to authenticated
using ((select public.tcn_is_editor()));

-- New users get a profile row; the trusted admin function also updates display name.
create or replace function public.tcn_new_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin
  insert into public.newsroom_profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name',''));
  return new;
end; $$;
drop trigger if exists tcn_auth_user_profile on auth.users;
create trigger tcn_auth_user_profile after insert on auth.users
for each row execute function public.tcn_new_profile();

grant select, insert, update on public.newsroom_profiles to authenticated;
grant select, insert, update, delete on public.newsroom_articles to authenticated;
grant select, insert, update, delete on public.newsroom_elections to authenticated;
