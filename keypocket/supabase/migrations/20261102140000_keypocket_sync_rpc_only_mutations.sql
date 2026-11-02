-- KeyPocket V2: force all sync-item mutations through the CAS + registered-device RPC.
--
-- The RPC was created with the registered-device check in
-- 20261102113000_keypocket_sync_registered_device_guard.sql. It is deliberately
-- SECURITY DEFINER only because the browser client must not hold direct write
-- privileges on the sync table. The function requires auth.uid(), checks an
-- active device belonging to that same user, and scopes all SQL to that user.
-- Its fixed empty search_path prevents object-shadowing attacks.
--
-- Supabase's SECURITY DEFINER advisor will report the authenticated RPC as a
-- review warning. This is an intentional, narrowly-scoped authenticated endpoint;
-- anonymous EXECUTE is revoked and direct table mutation is disabled.

alter function public.keypocket_sync_put_item(
  text, text, bigint, uuid, timestamptz, timestamptz, jsonb, integer
) security definer;

alter function public.keypocket_sync_put_item(
  text, text, bigint, uuid, timestamptz, timestamptz, jsonb, integer
) set search_path = '';

revoke all on function public.keypocket_sync_put_item(
  text, text, bigint, uuid, timestamptz, timestamptz, jsonb, integer
) from public, anon, authenticated;

grant execute on function public.keypocket_sync_put_item(
  text, text, bigint, uuid, timestamptz, timestamptz, jsonb, integer
) to authenticated;

revoke insert, update, delete, truncate, references, trigger
  on table public.keypocket_sync_items
  from public, anon, authenticated;

grant select on table public.keypocket_sync_items to authenticated;

drop policy if exists "KeyPocket users create own sync items"
  on public.keypocket_sync_items;

drop policy if exists "KeyPocket users update own sync items"
  on public.keypocket_sync_items;
