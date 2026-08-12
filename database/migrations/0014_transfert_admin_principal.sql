-- =============================================================================
-- StagePermit Digital — Transfert atomique du statut d'admin principal
--
-- Deux mises à jour séparées depuis l'application risqueraient un état
-- intermédiaire incohérent (zéro ou deux admins principaux) si la
-- deuxième échouait après la première. Cette fonction fait les deux dans
-- la même transaction, dans le bon ordre : retire l'ancien avant
-- d'accorder au nouveau, jamais l'inverse, pour ne jamais violer l'index
-- unique partiel de la migration 0002.
-- =============================================================================

create or replace function transferer_admin_principal(p_nouvel_admin_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update teacher set est_admin_principal = false where est_admin_principal = true;

  update teacher
  set est_admin_principal = true, est_admin = true
  where id = p_nouvel_admin_id;

  if not found then
    raise exception 'Agent introuvable.';
  end if;
end;
$$;
