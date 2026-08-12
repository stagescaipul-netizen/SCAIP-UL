-- =============================================================================
-- StagePermit Digital — Image de signature scannée
--
-- Chemin vers une image de signature dans le stockage Supabase (bucket
-- 'documents', même bucket que les PDF). Absent par défaut — le
-- générateur retombe alors sur l'encadré en pointillés existant.
-- =============================================================================

alter table identite_institutionnelle add column signature_image_path text;
