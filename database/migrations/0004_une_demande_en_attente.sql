-- =============================================================================
-- StagePermit Digital — Une seule demande en attente par étudiant
--
-- Empêche un même étudiant (numéro INE) d'avoir plusieurs demandes au
-- statut 'en_attente' simultanément. Une fois une demande validée,
-- refusée ou annulée, une nouvelle demande redevient possible.
--
-- Ne répond qu'à une des trois lectures possibles de "limiter les
-- soumissions" (doublons de traitement pour les agents) — pas à la
-- protection anti-bot, ni à un plafond de documents par période, qui
-- restent des décisions séparées.
-- =============================================================================

create unique index internship_request_one_pending_per_student
  on internship_request (student_id)
  where statut = 'en_attente';
