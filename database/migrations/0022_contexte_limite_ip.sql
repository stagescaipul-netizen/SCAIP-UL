-- =============================================================================
-- StagePermit Digital — Distinguer les contextes de limitation par IP
--
-- La table submission_attempt servait jusqu'ici uniquement à la
-- soumission du formulaire. La page de suivi (recherche par code à 6
-- chiffres) a besoin de la même protection contre les tentatives
-- répétées, mais ne doit pas consommer le même quota — sinon consulter
-- son statut plusieurs fois épuiserait la limite destinée à empêcher le
-- spam de nouvelles demandes.
-- =============================================================================

alter table submission_attempt add column contexte text not null default 'demande';

create index idx_submission_attempt_ip_time_contexte on submission_attempt (ip_address, contexte, horodatage);

-- create or replace ne suffit pas ici : le nombre de paramètres change,
-- Postgres traiterait ça comme une fonction distincte et garderait
-- l'ancienne à trois arguments en même temps, rendant tout appel à trois
-- arguments ambigu entre les deux versions.
drop function if exists ip_depasse_la_limite(text, integer, integer);

create function ip_depasse_la_limite(p_ip text, p_max_tentatives integer, p_fenetre_minutes integer, p_contexte text default 'demande')
returns boolean
language sql
stable
as $$
  select count(*) >= p_max_tentatives
  from submission_attempt
  where ip_address = p_ip
    and contexte = p_contexte
    and horodatage > now() - (p_fenetre_minutes || ' minutes')::interval;
$$;
