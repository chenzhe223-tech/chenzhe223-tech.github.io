-- MelodyMe initial schema draft.
-- NOT applied to any Supabase project. Review and test in a dedicated project first.
-- Core rule: private memories are not public posts. Publishing requires an explicit post snapshot.
begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Music keeper' check (char_length(display_name) <= 80),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  artist text check (artist is null or char_length(artist) <= 200),
  source_url text,
  source_provider text,
  provider_track_id text,
  metadata_verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (source_url is null or source_url ~ '^https?://')
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '一个音乐瞬间' check (char_length(title) <= 200),
  body text not null check (char_length(body) between 1 and 10000),
  happened_at date,
  year_label smallint check (year_label is null or year_label between 1900 and 2200),
  location_label text check (location_label is null or char_length(location_label) <= 200),
  people_label text check (people_label is null or char_length(people_label) <= 500),
  emotion_tags text[] not null default '{}',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_tracks (
  memory_id uuid not null references public.memories(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position smallint not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (memory_id, track_id)
);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_id uuid references public.memories(id) on delete set null,
  job_type text not null check (job_type in ('story','poster','caption','video_storyboard')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  attempt_count smallint not null default 0 check (attempt_count >= 0 and attempt_count <= 10),
  provider text,
  model text,
  result_json jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (user_id, idempotency_key)
);

create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_id uuid references public.memories(id) on delete set null,
  generation_job_id uuid references public.generation_jobs(id) on delete set null,
  artwork_type text not null check (artwork_type in ('poster','story','caption','video','storyboard')),
  title text not null default '' check (char_length(title) <= 200),
  content_text text,
  private_asset_path text,
  template_id text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (content_text is null or char_length(content_text) <= 20000)
);

-- Published post is an explicit user-approved snapshot, separate from the private memory/artwork.
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artwork_id uuid references public.artworks(id) on delete set null,
  title text not null default '' check (char_length(title) <= 200),
  body_snapshot text,
  asset_path text,
  status text not null default 'draft' check (status in ('draft','published','hidden')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (body_snapshot is null or char_length(body_snapshot) <= 20000),
  check (status <> 'published' or published_at is not null)
);

-- Only a hash is stored. A public resolver must hash the presented token and check revoked/expiry.
create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artwork_id uuid references public.artworks(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check ((artwork_id is not null)::integer + (post_id is not null)::integer = 1)
);

create index if not exists memories_user_updated_idx on public.memories(user_id, updated_at desc);
create index if not exists tracks_user_title_idx on public.tracks(user_id, title);
create index if not exists memory_tracks_user_idx on public.memory_tracks(user_id, memory_id);
create index if not exists generation_jobs_user_created_idx on public.generation_jobs(user_id, created_at desc);
create index if not exists generation_jobs_status_created_idx on public.generation_jobs(status, created_at) where status in ('queued','running');
create index if not exists artworks_user_updated_idx on public.artworks(user_id, updated_at desc);
create index if not exists posts_public_feed_idx on public.posts(published_at desc) where status = 'published';
create index if not exists share_links_user_idx on public.share_links(user_id, created_at desc);

create or replace function public.melodyme_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.melodyme_set_updated_at();
drop trigger if exists memories_updated_at on public.memories;
create trigger memories_updated_at before update on public.memories for each row execute function public.melodyme_set_updated_at();
drop trigger if exists artworks_updated_at on public.artworks;
create trigger artworks_updated_at before update on public.artworks for each row execute function public.melodyme_set_updated_at();
drop trigger if exists posts_updated_at on public.posts;
create trigger posts_updated_at before update on public.posts for each row execute function public.melodyme_set_updated_at();

alter table public.profiles enable row level security;
alter table public.tracks enable row level security;
alter table public.memories enable row level security;
alter table public.memory_tracks enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.artworks enable row level security;
alter table public.posts enable row level security;
alter table public.share_links enable row level security;

-- Profiles are private in the MVP; public profile projection can be added separately later.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "tracks_owner_all" on public.tracks;
create policy "tracks_owner_all" on public.tracks for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "memories_owner_all" on public.memories;
create policy "memories_owner_all" on public.memories for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "memory_tracks_owner_all" on public.memory_tracks;
create policy "memory_tracks_owner_all" on public.memory_tracks for all to authenticated using (
  auth.uid() = user_id
  and exists (select 1 from public.memories m where m.id = memory_id and m.user_id = auth.uid())
  and exists (select 1 from public.tracks t where t.id = track_id and t.user_id = auth.uid())
) with check (
  auth.uid() = user_id
  and exists (select 1 from public.memories m where m.id = memory_id and m.user_id = auth.uid())
  and exists (select 1 from public.tracks t where t.id = track_id and t.user_id = auth.uid())
);
drop policy if exists "generation_jobs_owner_all" on public.generation_jobs;
create policy "generation_jobs_owner_all" on public.generation_jobs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "artworks_owner_all" on public.artworks;
create policy "artworks_owner_all" on public.artworks for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "posts_owner_all" on public.posts;
create policy "posts_owner_all" on public.posts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "posts_public_read_published" on public.posts;
create policy "posts_public_read_published" on public.posts for select to anon, authenticated using (status = 'published');
drop policy if exists "share_links_owner_all" on public.share_links;
create policy "share_links_owner_all" on public.share_links for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;

-- Follow-up before production:
-- 1. Add grants only for intended roles and verify Supabase default grants.
-- 2. Ensure memory_tracks.user_id cannot be forged: policies cross-check ownership, but add a trigger or use server-side RPC to populate it safely.
-- 3. Add storage bucket policies for private assets and public post snapshots.
-- 4. Implement a server-side share resolver; never expose private artwork via a permanent public object URL.
-- 5. Test RLS using two real authenticated users in a dedicated Supabase project.
