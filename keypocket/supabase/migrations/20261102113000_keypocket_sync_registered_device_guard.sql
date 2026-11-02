-- KeyPocket V2: only active, registered devices may mutate encrypted sync rows.
create or replace function public.keypocket_sync_put_item(
  p_entity_type text,
  p_entity_id text,
  p_version bigint,
  p_device_id uuid,
  p_updated_at timestamptz,
  p_deleted_at timestamptz,
  p_payload jsonb,
  p_schema_version integer default 2
)
returns table (
  outcome text,
  current_version bigint,
  current_device_id uuid,
  current_updated_at timestamptz,
  current_deleted_at timestamptz,
  current_payload jsonb,
  current_schema_version integer
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid;
  v_row public.keypocket_sync_items%rowtype;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_entity_type not in ('key', 'project') then
    raise exception 'Invalid entity type' using errcode = '22023';
  end if;
  if p_entity_id is null or length(p_entity_id) < 1 or length(p_entity_id) > 200 then
    raise exception 'Invalid entity ID' using errcode = '22023';
  end if;
  if p_version is null or p_version < 1 then
    raise exception 'Version must be positive' using errcode = '22023';
  end if;
  if p_device_id is null or p_updated_at is null then
    raise exception 'Device ID and updated timestamp are required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload) <> 'object'
     or not (p_payload ? 'iv')
     or not (p_payload ? 'data')
     or length(coalesce(p_payload->>'iv', '')) = 0
     or length(coalesce(p_payload->>'data', '')) = 0 then
    raise exception 'Encrypted payload must include iv and data' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.keypocket_devices d
    where d.user_id = v_user_id
      and d.device_id = p_device_id
      and d.revoked_at is null
  ) then
    raise exception 'Device is not registered or has been revoked' using errcode = '42501';
  end if;

  insert into public.keypocket_sync_items (
    user_id, entity_type, entity_id, version, device_id,
    updated_at, deleted_at, payload, schema_version
  )
  values (
    v_user_id, p_entity_type, p_entity_id, p_version, p_device_id,
    p_updated_at, p_deleted_at, p_payload, greatest(coalesce(p_schema_version, 2), 2)
  )
  on conflict (user_id, entity_type, entity_id)
  do update set
    version = excluded.version,
    device_id = excluded.device_id,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at,
    payload = excluded.payload,
    schema_version = excluded.schema_version
  where public.keypocket_sync_items.version < excluded.version
  returning * into v_row;

  if found then
    return query select
      'accepted'::text, v_row.version, v_row.device_id, v_row.updated_at,
      v_row.deleted_at, v_row.payload, v_row.schema_version;
    return;
  end if;

  select * into v_row
  from public.keypocket_sync_items
  where user_id = v_user_id
    and entity_type = p_entity_type
    and entity_id = p_entity_id;

  if not found then
    raise exception 'Sync row could not be read after compare-and-set' using errcode = '40001';
  end if;

  if v_row.version = p_version
     and v_row.device_id = p_device_id
     and v_row.payload = p_payload
     and v_row.deleted_at is not distinct from p_deleted_at then
    return query select
      'already_applied'::text, v_row.version, v_row.device_id, v_row.updated_at,
      v_row.deleted_at, v_row.payload, v_row.schema_version;
  else
    return query select
      'conflict'::text, v_row.version, v_row.device_id, v_row.updated_at,
      v_row.deleted_at, v_row.payload, v_row.schema_version;
  end if;
end;
$function$;

revoke all on function public.keypocket_sync_put_item(text, text, bigint, uuid, timestamptz, timestamptz, jsonb, integer) from public;
revoke all on function public.keypocket_sync_put_item(text, text, bigint, uuid, timestamptz, timestamptz, jsonb, integer) from anon;
grant execute on function public.keypocket_sync_put_item(text, text, bigint, uuid, timestamptz, timestamptz, jsonb, integer) to authenticated;
