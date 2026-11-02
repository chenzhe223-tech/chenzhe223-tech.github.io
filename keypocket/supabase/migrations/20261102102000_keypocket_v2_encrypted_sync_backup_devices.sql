-- KeyPocket V2 encrypted sync, backup and device registry.
-- Legacy keypocket_vault_sync is retained for backward compatibility.
create table if not exists public.keypocket_sync_meta (
 user_id uuid primary key references auth.users(id) on delete cascade,
 key_salt text not null check (length(key_salt) between 20 and 128),
 iterations integer not null default 310000 check (iterations between 100000 and 1000000),
 schema_version integer not null default 2 check (schema_version > 0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.keypocket_sync_meta enable row level security;
revoke all on table public.keypocket_sync_meta from public, anon;
grant select, insert, update on table public.keypocket_sync_meta to authenticated;
create policy "KeyPocket users read own sync metadata" on public.keypocket_sync_meta for select to authenticated using ((select auth.uid()) = user_id);
create policy "KeyPocket users create own sync metadata" on public.keypocket_sync_meta for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "KeyPocket users update own sync metadata" on public.keypocket_sync_meta for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.keypocket_sync_items (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 entity_type text not null check (entity_type in ('key','project')),
 entity_id text not null check (length(entity_id) between 1 and 200),
 version bigint not null check (version > 0), device_id uuid not null,
 updated_at timestamptz not null, deleted_at timestamptz,
 payload jsonb not null check (jsonb_typeof(payload)='object' and payload ? 'iv' and payload ? 'data'),
 schema_version integer not null default 2 check (schema_version > 0),
 primary key (user_id,entity_type,entity_id)
);
create index if not exists keypocket_sync_items_updated_idx on public.keypocket_sync_items(user_id,updated_at desc);
alter table public.keypocket_sync_items enable row level security;
revoke all on table public.keypocket_sync_items from public, anon;
grant select, insert, update on table public.keypocket_sync_items to authenticated;
create policy "KeyPocket users read own sync items" on public.keypocket_sync_items for select to authenticated using ((select auth.uid())=user_id);
create policy "KeyPocket users create own sync items" on public.keypocket_sync_items for insert to authenticated with check ((select auth.uid())=user_id);
create policy "KeyPocket users update own sync items" on public.keypocket_sync_items for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create or replace function public.keypocket_upsert_sync_item(
 p_entity_type text,p_entity_id text,p_version bigint,p_device_id uuid,
 p_updated_at timestamptz,p_deleted_at timestamptz,p_payload jsonb
) returns table(applied boolean,server_version bigint,server_updated_at timestamptz)
language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_user_id uuid := (select auth.uid()); v_version bigint; v_updated_at timestamptz;
begin
 if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_entity_type not in ('key','project') then raise exception 'Invalid entity type' using errcode='22023'; end if;
 if p_entity_id is null or length(p_entity_id) not between 1 and 200 then raise exception 'Invalid entity id' using errcode='22023'; end if;
 if p_version is null or p_version<1 or p_device_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or not(p_payload?'iv') or not(p_payload?'data') then
  raise exception 'Invalid encrypted sync payload' using errcode='22023';
 end if;
 insert into public.keypocket_sync_items(user_id,entity_type,entity_id,version,device_id,updated_at,deleted_at,payload,schema_version)
 values(v_user_id,p_entity_type,p_entity_id,p_version,p_device_id,p_updated_at,p_deleted_at,p_payload,2)
 on conflict(user_id,entity_type,entity_id) do update set
  version=excluded.version,device_id=excluded.device_id,updated_at=excluded.updated_at,
  deleted_at=excluded.deleted_at,payload=excluded.payload,schema_version=excluded.schema_version
 where excluded.version>public.keypocket_sync_items.version
 or (excluded.version=public.keypocket_sync_items.version and
     (excluded.updated_at,excluded.device_id)>(public.keypocket_sync_items.updated_at,public.keypocket_sync_items.device_id))
 returning public.keypocket_sync_items.version,public.keypocket_sync_items.updated_at into v_version,v_updated_at;
 if found then return query select true,v_version,v_updated_at;
 else
  select s.version,s.updated_at into v_version,v_updated_at from public.keypocket_sync_items s
   where s.user_id=v_user_id and s.entity_type=p_entity_type and s.entity_id=p_entity_id;
  return query select false,v_version,v_updated_at;
 end if;
end $$;
revoke all on function public.keypocket_upsert_sync_item(text,text,bigint,uuid,timestamptz,timestamptz,jsonb) from public,anon;
grant execute on function public.keypocket_upsert_sync_item(text,text,bigint,uuid,timestamptz,timestamptz,jsonb) to authenticated;

create table if not exists public.keypocket_backup_snapshots (
 id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 device_id uuid not null,snapshot_type text not null check(snapshot_type in('daily','monthly','milestone')),
 period_key text not null check(length(period_key) between 1 and 80),schema_version integer not null default 2 check(schema_version>0),
 record_count integer not null default 0 check(record_count>=0),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload?'iv' and payload?'data' and payload?'salt'),
 created_at timestamptz not null default now(),unique(user_id,device_id,snapshot_type,period_key)
);
create index if not exists keypocket_backup_snapshots_created_idx on public.keypocket_backup_snapshots(user_id,created_at desc);
alter table public.keypocket_backup_snapshots enable row level security;
revoke all on table public.keypocket_backup_snapshots from public,anon;
grant select,insert,update,delete on table public.keypocket_backup_snapshots to authenticated;
create policy "KeyPocket users read own backup snapshots" on public.keypocket_backup_snapshots for select to authenticated using((select auth.uid())=user_id);
create policy "KeyPocket users create own backup snapshots" on public.keypocket_backup_snapshots for insert to authenticated with check((select auth.uid())=user_id);
create policy "KeyPocket users update own backup snapshots" on public.keypocket_backup_snapshots for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "KeyPocket users delete own backup snapshots" on public.keypocket_backup_snapshots for delete to authenticated using((select auth.uid())=user_id);

create table if not exists public.keypocket_devices (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,device_id uuid not null,
 device_label text not null default 'KeyPocket device' check(length(device_label) between 1 and 100),
 created_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),revoked_at timestamptz,
 primary key(user_id,device_id)
);
alter table public.keypocket_devices enable row level security;
revoke all on table public.keypocket_devices from public,anon;
grant select,insert,update on table public.keypocket_devices to authenticated;
create policy "KeyPocket users read own devices" on public.keypocket_devices for select to authenticated using((select auth.uid())=user_id);
create policy "KeyPocket users create own devices" on public.keypocket_devices for insert to authenticated with check((select auth.uid())=user_id);
create policy "KeyPocket users update own devices" on public.keypocket_devices for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
