-- =============================================================================
-- StagePermit Digital — Schéma initial
-- Généré à partir de DATA_MODEL.md (version finalisée)
-- Base : PostgreSQL / Supabase
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

create type student_verification_status as enum ('en_attente', 'verifie', 'rejete');
create type request_status as enum ('en_attente', 'validee', 'refusee', 'annulee');
create type document_type as enum ('autorisation', 'recommandation');
create type document_status as enum ('valide', 'expire', 'invalide_manuellement');
create type activity_actor_type as enum ('student', 'teacher', 'admin', 'systeme');
create type activity_entity_type as enum ('internship_request', 'document', 'student');
create type activity_event_type as enum (
  'compte_etudiant_soumis',
  'compte_etudiant_verifie',
  'compte_etudiant_rejete',
  'demande_soumise',
  'demande_validee',
  'demande_refusee',
  'demande_annulee',
  'document_genere',
  'document_invalide_manuellement',
  'connexion_email_secours_utilisee'
);

-- =============================================================================
-- STUDENT
-- =============================================================================

create table student (
  id uuid primary key default gen_random_uuid(),
  nom_complet text not null,
  numero_ine text not null,
  telephone text,
  email_personnel text not null,
  justificatif_inscription_fichier text,
  statut_verification_compte student_verification_status not null default 'en_attente',
  date_creation timestamptz not null default now(),
  constraint student_numero_ine_unique unique (numero_ine)
);

comment on table student is
  'Étudiant disposant d''un compte sur la plateforme. justificatif_inscription_fichier '
  'porte l''attestation d''inscription déposée à l''inscription (référence de stockage, '
  'pas le fichier lui-même).';

-- =============================================================================
-- TEACHER
-- Agent du Service Conseil et Aide à l'Insertion Professionnelle (SCAIP-UL).
-- Le nom "teacher" est conservé du périmètre initial du modèle de données ;
-- il ne désigne pas un enseignant disciplinaire — voir DATA_MODEL.md §0.
-- =============================================================================

create table teacher (
  id uuid primary key default gen_random_uuid(),
  nom_complet text not null,
  email_professionnel text not null,
  telephone text,
  email_secours_1 text,
  email_secours_2 text,
  actif boolean not null default true,
  constraint teacher_email_professionnel_unique unique (email_professionnel)
);

-- =============================================================================
-- ACADEMIC_YEAR
-- =============================================================================

create table academic_year (
  id uuid primary key default gen_random_uuid(),
  libelle text not null,
  date_debut date not null,
  date_fin date not null,
  constraint academic_year_libelle_unique unique (libelle),
  constraint academic_year_dates_coherentes check (date_fin > date_debut)
);

-- =============================================================================
-- PROGRAM
-- departement : champ texte simple (décision actée — pas d'entité Department
-- séparée dans le périmètre des 10 entités). Voir DATA_MODEL.md §1.4.
-- =============================================================================

create table program (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  departement text
);

-- =============================================================================
-- LEVEL
-- =============================================================================

create table level (
  id uuid primary key default gen_random_uuid(),
  libelle text not null,
  ordre integer not null
);

-- =============================================================================
-- ACADEMIC_ASSIGNMENT
-- Rattachement annuel d'un étudiant à un programme/niveau — préserve l'historique
-- d'une année sur l'autre plutôt que d'écraser des champs sur Student.
-- =============================================================================

create table academic_assignment (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student(id) on delete cascade,
  program_id uuid not null references program(id),
  level_id uuid not null references level(id),
  academic_year_id uuid not null references academic_year(id),
  constraint academic_assignment_one_per_year unique (student_id, academic_year_id)
);

create index idx_academic_assignment_student on academic_assignment(student_id);
create index idx_academic_assignment_program on academic_assignment(program_id);

-- =============================================================================
-- INTERNSHIP_REQUEST
-- =============================================================================

create table internship_request (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student(id),
  academic_assignment_id uuid not null references academic_assignment(id),
  agent_assigne_id uuid not null references teacher(id),
  agent_validateur_id uuid references teacher(id),
  statut request_status not null default 'en_attente',
  motif_refus text,
  certification_exactitude_horodatage timestamptz,
  certification_statut_etudiant_horodatage timestamptz,
  date_soumission timestamptz not null default now(),
  date_traitement timestamptz,
  constraint motif_refus_requis_si_refusee check (
    statut <> 'refusee' or motif_refus is not null
  ),
  constraint certifications_requises_a_soumission check (
    certification_exactitude_horodatage is not null
    and certification_statut_etudiant_horodatage is not null
  )
);

comment on table internship_request is
  'Une demande validée génère systématiquement les deux types de Document '
  '(autorisation + recommandation) — logique appliquée côté application, pas '
  'par un trigger SQL. Voir DATA_MODEL.md §1.7.';

create index idx_internship_request_student on internship_request(student_id);
create index idx_internship_request_agent_assigne on internship_request(agent_assigne_id);
create index idx_internship_request_statut on internship_request(statut);

-- =============================================================================
-- DOCUMENT
-- reference : séquence partagée par dossier (même numéro, suffixe A/R différent).
-- Générée côté application — voir fonction next_dossier_reference() ci-dessous.
-- =============================================================================

create sequence dossier_reference_seq start 1;

create table document (
  id uuid primary key default gen_random_uuid(),
  internship_request_id uuid not null references internship_request(id),
  type document_type not null,
  reference text not null,
  date_emission date not null default current_date,
  date_expiration date not null,
  statut document_status not null default 'valide',
  fichier_pdf text,
  constraint document_reference_unique unique (reference)
);

create index idx_document_internship_request on document(internship_request_id);

-- Fonction utilitaire : calcule le statut effectif d'un document (expire vs valide),
-- sans écraser un invalide_manuellement déjà posé.
create or replace function document_statut_effectif(doc document)
returns document_status
language sql
stable
as $$
  select case
    when doc.statut = 'invalide_manuellement' then doc.statut
    when doc.date_expiration < current_date then 'expire'::document_status
    else 'valide'::document_status
  end;
$$;

-- =============================================================================
-- ACTIVITY_LOG
-- Écriture seule. Conservé 6 mois, indépendamment du dossier qu'il documente
-- (Settings.duree_conservation_journal_mois).
-- =============================================================================

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  horodatage timestamptz not null default now(),
  type_evenement activity_event_type not null,
  acteur_type activity_actor_type not null,
  acteur_id uuid,
  entite_concernee_type activity_entity_type not null,
  entite_concernee_id uuid not null,
  details text
);

create index idx_activity_log_entite on activity_log(entite_concernee_type, entite_concernee_id);
create index idx_activity_log_horodatage on activity_log(horodatage);

-- =============================================================================
-- SETTINGS
-- Un seul enregistrement global. Le plafond de 2 emails de secours par agent
-- N'EST PAS ici — valeur fixe non paramétrable, actée explicitement.
-- =============================================================================

create table settings (
  id uuid primary key default gen_random_uuid(),
  duree_validite_document_mois integer not null default 3,
  duree_conservation_dossier_mois integer not null default 12,
  duree_conservation_journal_mois integer not null default 6
);

-- Empêche plus d'un enregistrement Settings (singleton applicatif).
create unique index settings_singleton on settings ((true));

insert into settings (duree_validite_document_mois, duree_conservation_dossier_mois, duree_conservation_journal_mois)
values (3, 12, 6);

-- =============================================================================
-- SÉCURITÉ — Row Level Security activée par défaut sur toutes les tables.
-- Aucune politique d'accès n'est définie dans cette migration : tant qu'aucune
-- politique n'est ajoutée, l'accès est refusé par défaut (fail-closed).
-- Les politiques réelles (qui peut lire/écrire quoi) relèvent du LOT
-- authentification & rôles, pas de ce schéma — ne pas déduire de politique ici.
-- =============================================================================

alter table student enable row level security;
alter table teacher enable row level security;
alter table academic_year enable row level security;
alter table program enable row level security;
alter table level enable row level security;
alter table academic_assignment enable row level security;
alter table internship_request enable row level security;
alter table document enable row level security;
alter table activity_log enable row level security;
alter table settings enable row level security;
