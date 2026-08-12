-- =============================================================================
-- StagePermit Digital — Authentification visuelle des documents
--
-- Deux modes sont supportés :
--   separate : signature et cachet téléversés séparément puis superposés
--   combined : une image unique signature + cachet
--
-- Compatibilité : une ancienne signature déjà enregistrée est conservée et
-- utilisée comme image combinée afin qu'un déploiement ne casse pas les
-- installations existantes.
-- =============================================================================

alter table identite_institutionnelle
  add column if not exists authentication_mode text not null default 'separate',
  add column if not exists cachet_image_path text,
  add column if not exists combined_image_path text;

alter table identite_institutionnelle
  drop constraint if exists identite_authentication_mode_check;

alter table identite_institutionnelle
  add constraint identite_authentication_mode_check
  check (authentication_mode in ('separate', 'combined'));

-- Les anciennes installations ne connaissaient qu'une image de signature.
-- On la préserve comme image combinée pour éviter toute régression.
update identite_institutionnelle
set combined_image_path = signature_image_path,
    authentication_mode = 'combined'
where signature_image_path is not null
  and combined_image_path is null;
