-- =============================================================================
-- StagePermit Digital — Limitation par adresse IP
--
-- Journal léger des tentatives de soumission du formulaire public, utilisé
-- pour limiter le nombre de soumissions par adresse IP sur une fenêtre de
-- temps. Écrit et lu uniquement par le code serveur (clé de service) — le
-- formulaire public n'y accède jamais directement.
-- =============================================================================

create table submission_attempt (
  id uuid primary key default gen_random_uuid(),
  ip_address text not null,
  horodatage timestamptz not null default now()
);

create index idx_submission_attempt_ip_time on submission_attempt (ip_address, horodatage);

alter table submission_attempt enable row level security;
-- Aucune politique définie intentionnellement : accès refusé par défaut à
-- tout rôle authentifié via RLS, seul le code serveur (clé de service,
-- qui contourne RLS) y écrit et y lit.

-- Fonction utilitaire : renvoie vrai si l'adresse IP a dépassé la limite
-- sur la fenêtre donnée. N'écrit rien elle-même — l'écriture de la
-- tentative reste à la charge du code appelant, après vérification.
create or replace function ip_depasse_la_limite(p_ip text, p_max_tentatives integer, p_fenetre_minutes integer)
returns boolean
language sql
stable
as $$
  select count(*) >= p_max_tentatives
  from submission_attempt
  where ip_address = p_ip
    and horodatage > now() - (p_fenetre_minutes || ' minutes')::interval;
$$;
