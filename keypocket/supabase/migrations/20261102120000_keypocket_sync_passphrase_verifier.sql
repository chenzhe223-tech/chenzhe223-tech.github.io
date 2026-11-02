-- Encrypted verifier prevents a device with a wrong sync passphrase from overwriting cloud ciphertext.
alter table public.keypocket_sync_meta
  add column if not exists key_verifier jsonb;

alter table public.keypocket_sync_meta
  drop constraint if exists keypocket_sync_meta_key_verifier_shape;

alter table public.keypocket_sync_meta
  add constraint keypocket_sync_meta_key_verifier_shape
  check (
    key_verifier is null
    or (
      jsonb_typeof(key_verifier) = 'object'
      and key_verifier ? 'iv'
      and key_verifier ? 'data'
      and length(coalesce(key_verifier->>'iv','')) > 0
      and length(coalesce(key_verifier->>'data','')) > 0
    )
  );
