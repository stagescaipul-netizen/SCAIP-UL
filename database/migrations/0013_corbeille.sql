-- =============================================================================
-- StagePermit Digital — Corbeille pour les demandes
--
-- Ajoute une dimension "à la corbeille" indépendante du statut métier
-- (en_attente / validee / refusee / annulee), qui reste inchangé — pour
-- pouvoir restaurer une demande exactement dans l'état où elle était.
--
-- Une demande à la corbeille ne compte plus pour les contraintes "une
-- seule demande en attente" (migration 0004) ni "un document valide à la
-- fois" (migration 0005) — sans ça, mettre une demande à la corbeille
-- resterait bloquant pour l'étudiant, ce qui contredit l'intention même
-- de la fonctionnalité.
-- =============================================================================

alter table internship_request add column supprime_le timestamptz;

-- Remplace l'index partiel de la migration 0004 pour exclure les demandes
-- à la corbeille.
drop index if exists internship_request_one_pending_per_student;
create unique index internship_request_one_pending_per_student
  on internship_request (student_id)
  where statut = 'en_attente' and supprime_le is null;

-- Remplace la fonction de la migration 0005 pour exclure les demandes à
-- la corbeille du calcul "document encore valide".
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
      and ir.supprime_le is null
      and d.statut <> 'invalide_manuellement'
      and d.date_expiration >= current_date
  ) into v_existant;

  if v_existant then
    raise exception 'Une demande valide existe déjà pour cet étudiant, non encore expirée.';
  end if;

  return new;
end;
$$;
