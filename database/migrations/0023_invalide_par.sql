-- =============================================================================
-- StagePermit Digital — Qui a invalidé, pas seulement que c'est invalidé
--
-- Le rapport exportable affichait "invalide_manuellement" sans dire qui
-- a pris cette décision. Renseigné directement par l'action
-- d'invalidation elle-même (pas par un déclencheur) — c'est le seul
-- endroit qui connaît l'identité de l'agent au moment de l'action.
-- =============================================================================

alter table journal_demandes add column invalide_par text;
