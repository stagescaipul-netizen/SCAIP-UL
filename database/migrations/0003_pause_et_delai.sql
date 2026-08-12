-- =============================================================================
-- StagePermit Digital — Arrêt global et validation différée (optionnelle)
--
-- Les deux réglages sont désactivés par défaut. Rien ne change dans le
-- comportement du système tant qu'un administrateur ne les active pas
-- explicitement.
--
-- La validation différée par délai n'a pas de confirmation tracée du
-- client à ce jour (voir échange du LOT 04) — implémentée comme option
-- désactivable, jamais comme comportement par défaut. Si elle est un jour
-- activée, l'agent validateur reste NULL et le journal d'audit trace un
-- acteur 'systeme', pas 'teacher' — pas de fausse attribution à un agent.
-- =============================================================================

alter table settings
  add column delivrance_suspendue boolean not null default false,
  add column generation_differee_activee boolean not null default false,
  add column generation_differee_delai_heures integer not null default 24;

comment on column settings.delivrance_suspendue is
  'Interrupteur global. Si actif, aucun document ne peut être généré, même '
  'si un agent valide une demande — bloqué au niveau base (trigger), pas '
  'seulement côté application.';

comment on column settings.generation_differee_activee is
  'Désactivé par défaut. Si activé, une demande sans action d''un agent '
  'après generation_differee_delai_heures est validée automatiquement.';

alter table settings add constraint delai_positif
  check (generation_differee_delai_heures > 0);

-- =============================================================================
-- Filet de sécurité au niveau base : bloque toute génération de document
-- si la délivrance est suspendue, quel que soit le chemin applicatif.
-- =============================================================================

create or replace function check_delivrance_non_suspendue()
returns trigger language plpgsql as $$
begin
  if (select delivrance_suspendue from settings limit 1) then
    raise exception 'Délivrance de documents suspendue par un administrateur.';
  end if;
  return new;
end;
$$;

create trigger trg_check_delivrance_non_suspendue
  before insert on document
  for each row execute function check_delivrance_non_suspendue();

-- =============================================================================
-- Validation automatique différée — fonction à appeler périodiquement par
-- un déclencheur externe (pg_cron ou tâche planifiée applicative), hors
-- périmètre de cette migration. Sans effet si l'option n'est pas activée
-- ou si la délivrance est suspendue.
-- =============================================================================

create or replace function auto_valider_demandes_en_retard()
returns integer
language plpgsql
security definer
as $$
declare
  v_settings settings%rowtype;
  v_count integer := 0;
  v_req record;
begin
  select * into v_settings from settings limit 1;

  if not v_settings.generation_differee_activee or v_settings.delivrance_suspendue then
    return 0;
  end if;

  for v_req in
    select id from internship_request
    where statut = 'en_attente'
      and date_soumission < now() - (v_settings.generation_differee_delai_heures || ' hours')::interval
  loop
    update internship_request
    set statut = 'validee', date_traitement = now(), agent_validateur_id = null
    where id = v_req.id;

    insert into activity_log (type_evenement, acteur_type, entite_concernee_type, entite_concernee_id, details)
    values (
      'demande_validee', 'systeme', 'internship_request', v_req.id,
      'Validation automatique après délai configuré — aucune action d''agent.'
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
