-- =============================================================================
-- StagePermit Digital — Référentiel des niveaux
--
-- Liste fixe et connue (contrairement au département/programme, qui reste
-- en saisie libre faute de liste exhaustive) — seedée directement ici pour
-- qu'un menu déroulant "Niveau" ne soit jamais vide sur une base fraîche.
-- Idempotent : ne réinsère rien si déjà présent.
-- =============================================================================

insert into level (libelle, ordre)
select v.libelle, v.ordre
from (values
  ('L1', 1),
  ('L2', 2),
  ('L3', 3),
  ('M1', 4),
  ('M2', 5),
  ('Doctorat', 6)
) as v(libelle, ordre)
where not exists (
  select 1 from level where level.libelle = v.libelle
);
