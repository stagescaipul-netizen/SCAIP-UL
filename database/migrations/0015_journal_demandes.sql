-- =============================================================================
-- StagePermit Digital — Journal permanent des demandes
--
-- Table indépendante, sans clé étrangère vers internship_request — une
-- suppression définitive (corbeille, migration 0013) ne doit jamais
-- l'affecter, contrairement à toutes les autres tables du projet qui
-- suivent le cycle de vie normal des données. Alimentée par déclencheurs,
-- pas par le code applicatif, pour ne jamais dépendre qu'un développeur
-- pense à l'appeler dans chaque chemin de code qui touche une demande.
-- =============================================================================

create table journal_demandes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  nom_etudiant text not null,
  numero_ine text not null,
  contact text,
  departement text,
  filiere text,
  niveau text,
  statut text not null,
  reference_autorisation text,
  reference_recommandation text,
  date_soumission timestamptz not null,
  date_derniere_maj timestamptz not null default now()
);

create unique index journal_demandes_request_id_unique on journal_demandes (request_id);

alter table journal_demandes enable row level security;

create policy journal_demandes_read_staff on journal_demandes
  for select using (auth_is_teacher());

-- Aucune politique d'écriture : seuls les déclencheurs ci-dessous
-- (exécutés avec les privilèges du propriétaire, security definer)
-- écrivent dans cette table.

create or replace function maj_journal_demande()
returns trigger
language plpgsql
security definer
as $$
declare
  v_student record;
  v_assignment record;
  v_ref_a text;
  v_ref_r text;
begin
  select nom_complet, numero_ine, telephone, email_personnel
  into v_student
  from student where id = new.student_id;

  select p.departement, p.nom as filiere, l.libelle as niveau
  into v_assignment
  from academic_assignment aa
  join program p on p.id = aa.program_id
  join level l on l.id = aa.level_id
  where aa.id = new.academic_assignment_id;

  select reference into v_ref_a from document
  where internship_request_id = new.id and type = 'autorisation' limit 1;
  select reference into v_ref_r from document
  where internship_request_id = new.id and type = 'recommandation' limit 1;

  insert into journal_demandes (
    request_id, nom_etudiant, numero_ine, contact, departement, filiere, niveau,
    statut, reference_autorisation, reference_recommandation, date_soumission
  ) values (
    new.id, v_student.nom_complet, v_student.numero_ine,
    coalesce(v_student.telephone, v_student.email_personnel),
    v_assignment.departement, v_assignment.filiere, v_assignment.niveau,
    new.statut, v_ref_a, v_ref_r, new.date_soumission
  )
  on conflict (request_id) do update set
    statut = excluded.statut,
    reference_autorisation = excluded.reference_autorisation,
    reference_recommandation = excluded.reference_recommandation,
    date_derniere_maj = now();

  return new;
end;
$$;

create trigger trg_maj_journal_demande
  after insert or update on internship_request
  for each row execute function maj_journal_demande();

-- Un document est créé après la demande — il faut aussi mettre à jour le
-- journal à ce moment-là, pas seulement quand internship_request change.
create or replace function maj_journal_depuis_document()
returns trigger
language plpgsql
security definer
as $$
begin
  update journal_demandes
  set
    reference_autorisation = case when new.type = 'autorisation' then new.reference else reference_autorisation end,
    reference_recommandation = case when new.type = 'recommandation' then new.reference else reference_recommandation end,
    date_derniere_maj = now()
  where request_id = new.internship_request_id;

  return new;
end;
$$;

create trigger trg_maj_journal_depuis_document
  after insert on document
  for each row execute function maj_journal_depuis_document();
