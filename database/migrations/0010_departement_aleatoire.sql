-- =============================================================================
-- StagePermit Digital — Sélection aléatoire d'un département pour la
-- question de vérification.
--
-- La question ne porte plus sur le département déclaré par l'étudiant —
-- décision du client : elle doit changer à chaque visite, sans lien avec
-- le département de l'étudiant, pour tester une connaissance générale de
-- l'université plutôt qu'un fait lié à sa propre déclaration.
-- =============================================================================

create or replace function departement_aleatoire()
returns text
language sql
stable
as $$
  select departement from department_head order by random() limit 1;
$$;

-- Conserve quel département a réellement été tiré au sort et affiché à
-- l'étudiant — indispensable pour que l'agent comprenne à quoi se
-- rapporte le résultat de vérification, puisque ce n'est plus forcément
-- le département propre de l'étudiant.
alter table internship_request
  add column departement_verification_pose text;
