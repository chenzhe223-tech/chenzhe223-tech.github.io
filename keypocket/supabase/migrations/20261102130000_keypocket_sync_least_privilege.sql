-- KeyPocket V2 security hardening: remove table-wide privileges that bypass RLS.
-- Keep only the CRUD operations needed by the client and the per-user policies.

revoke truncate, references, trigger on table
  public.keypocket_sync_meta,
  public.keypocket_sync_items,
  public.keypocket_devices,
  public.keypocket_backup_snapshots,
  public.keypocket_vault_sync
from public, anon, authenticated;

-- Sync item mutations must pass through keypocket_sync_put_item (CAS + active-device guard).
revoke delete on table public.keypocket_sync_items from public, anon, authenticated;
revoke delete on table public.keypocket_devices from public, anon, authenticated;
revoke delete on table public.keypocket_sync_meta from public, anon, authenticated;

-- The legacy broad upsert RPC predates the active-device guard.
-- The current client does not call it; disable it rather than leave a revocation bypass.
revoke all on function public.keypocket_upsert_sync_item(
  text, text, bigint, uuid, timestamptz, timestamptz, jsonb
) from public, anon, authenticated;

-- Explicit least-privilege grants. RLS still scopes every row to auth.uid().
grant select, insert, update on table public.keypocket_sync_meta to authenticated;
grant select, insert, update on table public.keypocket_sync_items to authenticated;
grant select, insert, update on table public.keypocket_devices to authenticated;
grant select, insert, update, delete on table public.keypocket_backup_snapshots to authenticated;
grant select, insert, update on table public.keypocket_vault_sync to authenticated;

-- Confirm public/anonymous roles do not inherit table-wide access from PUBLIC.
revoke all on table
  public.keypocket_sync_meta,
  public.keypocket_sync_items,
  public.keypocket_devices,
  public.keypocket_backup_snapshots,
  public.keypocket_vault_sync
from public, anon;
