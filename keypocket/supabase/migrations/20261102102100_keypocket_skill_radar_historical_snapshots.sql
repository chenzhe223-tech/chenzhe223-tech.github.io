-- Public read-only Skill Radar with service-role daily collector.
create table if not exists public.keypocket_skill_repos (
 id bigint primary key,full_name text not null unique,owner text not null,repo_name text not null,description text,html_url text not null,
 stars integer not null default 0 check(stars>=0),forks integer not null default 0 check(forks>=0),language text,topics text[] not null default '{}',
 pushed_at timestamptz,updated_at timestamptz,archived boolean not null default false,fork boolean not null default false,
 default_branch text,readme_relevance integer not null default 0 check(readme_relevance between 0 and 100),
 discovered_at timestamptz not null default now(),sampled_at timestamptz not null default now()
);
create index if not exists keypocket_skill_repos_stars_idx on public.keypocket_skill_repos(stars desc) where archived=false and fork=false;
create table if not exists public.keypocket_skill_snapshots (
 id bigint generated always as identity primary key,repo_id bigint not null references public.keypocket_skill_repos(id) on delete cascade,
 sampled_on date not null,stars integer not null check(stars>=0),forks integer not null check(forks>=0),
 open_issues integer not null default 0 check(open_issues>=0),pushed_at timestamptz,sampled_at timestamptz not null default now(),
 unique(repo_id,sampled_on)
);
create index if not exists keypocket_skill_snapshots_repo_date_idx on public.keypocket_skill_snapshots(repo_id,sampled_on desc);
alter table public.keypocket_skill_repos enable row level security;
alter table public.keypocket_skill_snapshots enable row level security;
revoke all on table public.keypocket_skill_repos from public,anon,authenticated;
revoke all on table public.keypocket_skill_snapshots from public,anon,authenticated;
grant select on table public.keypocket_skill_repos to anon,authenticated;
grant select on table public.keypocket_skill_snapshots to anon,authenticated;
grant all on table public.keypocket_skill_repos to service_role;
grant all on table public.keypocket_skill_snapshots to service_role;
create policy "Public can read KeyPocket Skill Radar repositories" on public.keypocket_skill_repos for select to anon,authenticated using(true);
create policy "Public can read KeyPocket Skill Radar snapshots" on public.keypocket_skill_snapshots for select to anon,authenticated using(true);
