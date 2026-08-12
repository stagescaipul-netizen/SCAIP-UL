-- =============================================================================
-- StagePermit Digital — L'invalidation d'un document doit apparaître au
-- journal permanent
--
-- Jusqu'ici, le journal ne reflétait que le statut de la DEMANDE
-- (en_attente / validee / refusee), jamais celui du DOCUMENT
-- (invalide_manuellement). Le déclencheur lié aux documents ne se
-- déclenchait qu'à leur création, jamais à leur modification — invalider
-- un document (une mise à jour, pas une création) passait donc
-- totalement inaperçu dans le rapport exportable.
-- =============================================================================

alter table journal_demandes add column statut_document text;

create or replace function maj_journal_depuis_document()
returns trigger
language plpgsql
security definer
as $$
declare
  v_autre_statut text;
begin
  -- Statut global du dossier : si l'un des deux documents est invalidé,
  -- le dossier entier est signalé comme tel dans le rapport — cohérent
  -- avec le principe déjà en place que les deux documents s'invalident
  -- toujours ensemble.
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
    date_derniere_maj = now()
  where request_id = new.internship_request_id;

  return new;
end;
$$;

drop trigger if exists trg_maj_journal_depuis_document on document;
create trigger trg_maj_journal_depuis_document
  after insert or update on document
  for each row execute function maj_journal_depuis_document();
