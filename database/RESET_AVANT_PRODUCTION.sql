-- =============================================================================
-- StagePermit Digital — Remise à zéro avant mise en production
--
-- À NE PAS exécuter maintenant. À lancer une seule fois, au moment exact
-- où tu passes réellement en service, jamais avant, jamais "juste pour
-- essayer" — cette opération supprime définitivement toutes les données
-- de test (étudiants, demandes, documents, journal).
--
-- Ce que ça fait, dans l'ordre : vide les tables qui contiennent des
-- données de test, puis remet le compteur de référence à zéro. Les deux
-- ensemble, jamais l'un sans l'autre — remettre le compteur seul sans
-- vider les documents provoquerait une collision de référence dès le
-- premier vrai document généré (contrainte d'unicité sur la référence).
--
-- Conserve intactes : les tables de configuration (settings, teacher,
-- identite_institutionnelle, department_head, program, level,
-- academic_year) — rien de tout ça n'est une donnée de test, tout doit
-- rester en place.
-- =============================================================================

truncate table
  journal_demandes,
  activity_log,
  submission_attempt,
  document,
  internship_request,
  academic_assignment,
  student
restart identity cascade;

select setval('dossier_reference_seq', 1, false);

-- Vérification : les deux doivent renvoyer 0.
select count(*) as etudiants_restants from student;
select count(*) as demandes_restantes from internship_request;
