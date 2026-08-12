-- =============================================================================
-- StagePermit Digital — Délai de validation différée en minutes
--
-- Remplace l'unité heures par minutes, pour permettre de tester le mode
-- différé sans attendre une heure complète. La valeur existante est
-- convertie automatiquement (× 60) pour ne pas changer silencieusement
-- le comportement d'un réglage déjà en place.
-- =============================================================================

alter table settings add column generation_differee_delai_minutes integer;

update settings set generation_differee_delai_minutes = generation_differee_delai_heures * 60;

alter table settings alter column generation_differee_delai_minutes set not null;
alter table settings add constraint delai_minutes_positif check (generation_differee_delai_minutes > 0);

alter table settings drop column generation_differee_delai_heures;

-- La fonction d'auto-validation différée doit désormais comparer en
-- minutes, pas en heures.
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
      and date_soumission < now() - (v_settings.generation_differee_delai_minutes || ' minutes')::interval
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
