-- =============================================================================
-- StagePermit Digital — Fonction d'accès à la séquence de référence
--
-- Supabase-js n'expose pas nextval() directement via l'API REST/RPC ; cette
-- fonction sert de pont. Utilisée par lib/pdf/reference.ts au moment de la
-- validation d'une demande.
-- =============================================================================

create or replace function nextval_dossier_reference()
returns bigint
language sql
as $$
  select nextval('dossier_reference_seq');
$$;
