-- =============================================================================
-- StagePermit Digital — Dates d'émission et d'expiration au journal
--
-- Le journal ne gardait que la date de soumission de la demande, jamais
-- la vraie période de validité du document lui-même (émission →
-- expiration). Les deux informations sont différentes : une demande
-- peut être soumise un jour et son document émis plus tard, une fois
-- validée.
-- =============================================================================

alter table journal_demandes add column date_emission date;
alter table journal_demandes add column date_expiration date;

create or replace function maj_journal_depuis_document()
returns trigger
language plpgsql
security definer
as $$
declare
  v_autre_statut text;
begin
  select statut into v_autre_statut
  from document
  where internship_request_id = new.internship_request_id and id <> new.id
  limit 1;

  update journal_demandes
  set
    reference_autorisation = case when new.type = 'autorisation' then new.reference else reference_autorisation end,
    reference_recommandation = case when new.type = 'recommandation' then new.reference else reference_recommandation end,
    statut_document = case
      when new.statut = 'invalide_manuellement' or v_autre_statut = 'invalide_manuellement' then 'invalide_manuellement'
      else new.statut
    end,
    date_emission = new.date_emission,
    date_expiration = new.date_expiration,
    date_derniere_maj = now()
  where request_id = new.internship_request_id;

  return new;
end;
$$;
