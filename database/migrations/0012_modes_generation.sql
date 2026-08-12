-- =============================================================================
-- StagePermit Digital — Trois modes de génération, un seul réglage
--
-- Remplace le booléen generation_differee_activee par un type énuméré
-- explicite, pour éviter tout état contradictoire entre plusieurs
-- booléens. Trois valeurs possibles :
--   - confirmation_obligatoire (valeur par défaut, confirmée par le
--     client) : rien ne se génère sans qu'un agent valide la demande.
--   - differe : validation automatique après un délai, sauf action d'un
--     agent entre-temps (déjà construit en migration 0003, repris ici).
--   - automatique : génération immédiate à la soumission, sans délai ni
--     action humaine, si toutes les vérifications automatiques passent.
--     Nouveau mode — n'a jamais été le comportement par défaut et ne le
--     devient pas ici non plus.
-- =============================================================================

create type mode_generation as enum ('confirmation_obligatoire', 'differe', 'automatique');

alter table settings add column mode_generation mode_generation not null default 'confirmation_obligatoire';

-- Reprend l'état existant : si le différé était déjà activé, on le
-- conserve tel quel plutôt que de le réinitialiser silencieusement.
update settings set mode_generation = 'differe' where generation_differee_activee = true;

alter table settings drop column generation_differee_activee;

-- La fonction d'auto-validation différée (migration 0003) doit maintenant
-- vérifier le nouveau réglage unifié, plus l'ancien booléen supprimé.
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

  if v_settings.mode_generation <> 'differe' or v_settings.delivrance_suspendue then
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
