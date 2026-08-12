-- =============================================================================
-- StagePermit Digital — Blocage tant qu'un document valide existe déjà
--
-- Complète la migration 0004 : celle-ci bloquait uniquement pendant la
-- phase "en attente". Cette migration bloque toute nouvelle demande tant
-- que l'étudiant détient déjà un document non expiré et non invalidé
-- manuellement — cohérent avec le principe du document générique et
-- réutilisable : aucune raison légitime de redemander tant que le
-- précédent reste valable.
-- =============================================================================

create or replace function check_pas_de_document_valide_existant()
returns trigger
language plpgsql
as $$
declare
  v_existant boolean;
begin
  select exists (
    select 1
    from internship_request ir
    join document d on d.internship_request_id = ir.id
    where ir.student_id = new.student_id
      and d.statut <> 'invalide_manuellement'
      and d.date_expiration >= current_date
  ) into v_existant;

  if v_existant then
    raise exception 'Une demande valide existe déjà pour cet étudiant, non encore expirée.';
  end if;

  return new;
end;
$$;

create trigger trg_check_pas_de_document_valide_existant
  before insert on internship_request
  for each row execute function check_pas_de_document_valide_existant();
