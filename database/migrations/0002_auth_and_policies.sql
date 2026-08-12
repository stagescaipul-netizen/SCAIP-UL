-- =============================================================================
-- StagePermit Digital — Authentification & rôles (corrigé)
-- Étend le schéma 0001 avec la liaison Supabase Auth et les politiques RLS.
--
-- CORRECTION IMPORTANTE : l'étudiant n'a JAMAIS de compte ni de session.
-- Le projet est un formulaire public (accessible par QR code) — pas une
-- application avec connexion étudiante. Toute écriture/lecture côté
-- étudiant passe par du code serveur de confiance (Server Actions avec la
-- clé de service), pas par une session authentifiée. Une version
-- précédente de cette migration avait inventé un système de compte
-- étudiant qui n'a jamais été discuté — corrigé ici.
--
-- Seuls les agents et administrateurs (table teacher) s'authentifient
-- réellement via Supabase Auth.
--
-- Décisions prises en autonomie, documentées :
--   1. Pas de 11e entité "Admin" : le rôle admin est un indicateur sur
--      `teacher` (est_admin), pas une entité séparée.
--   2. Gouvernance admin façon WhatsApp (un admin principal gère qui est
--      admin) : implémentée via est_admin_principal.
--   3. La vérification des comptes étudiants (justificatif d'inscription)
--      revient aux comptes est_admin = true.
-- =============================================================================

-- =============================================================================
-- LIAISON AUTH — TEACHER UNIQUEMENT
-- =============================================================================

alter table teacher
  add column auth_user_id uuid references auth.users(id) on delete set null,
  add constraint teacher_auth_user_unique unique (auth_user_id),
  add column est_admin boolean not null default false,
  add column est_admin_principal boolean not null default false;

comment on column teacher.est_admin is
  'Rôle administrateur — tous les administrateurs ont les mêmes droits '
  'opérationnels (confirmé par le client), à l''exception de la gestion de '
  'la liste des admins elle-même, réservée à est_admin_principal.';

comment on column teacher.est_admin_principal is
  'Seul un compte avec ce indicateur peut ajouter/retirer d''autres '
  'administrateurs. Mesure de gouvernance ajoutée par l''équipe technique, '
  'nécessaire pour éviter qu''un admin puisse s''auto-isoler ou retirer '
  'tous les autres.';

create unique index teacher_admin_principal_unique
  on teacher (est_admin_principal)
  where est_admin_principal = true;

alter table teacher add constraint admin_principal_implique_admin
  check (not est_admin_principal or est_admin);

-- =============================================================================
-- FONCTIONS UTILITAIRES POUR LES POLITIQUES
-- =============================================================================

create or replace function auth_is_teacher()
returns boolean language sql stable security definer as $$
  select exists (select 1 from teacher where auth_user_id = auth.uid() and actif = true);
$$;

create or replace function auth_is_admin()
returns boolean language sql stable security definer as $$
  select exists (select 1 from teacher where auth_user_id = auth.uid() and actif = true and est_admin = true);
$$;

create or replace function auth_is_admin_principal()
returns boolean language sql stable security definer as $$
  select exists (select 1 from teacher where auth_user_id = auth.uid() and actif = true and est_admin_principal = true);
$$;

-- =============================================================================
-- POLITIQUES — STUDENT
-- Aucun accès direct pour un rôle "étudiant" puisqu'il n'existe pas de
-- session étudiante. La création/lecture/mise à jour des dossiers
-- étudiants côté formulaire public passe exclusivement par des Server
-- Actions utilisant la clé de service (contourne RLS intentionnellement,
-- sous contrôle du code applicatif). Les politiques ci-dessous ne couvrent
-- que l'accès des agents/admins depuis leur session authentifiée.
-- =============================================================================

create policy student_select_staff on student
  for select using (auth_is_teacher() or auth_is_admin());

create policy student_verification_update on student
  for update using (auth_is_admin())
  with check (auth_is_admin());

-- =============================================================================
-- POLITIQUES — TEACHER
-- =============================================================================

create policy teacher_select_all on teacher
  for select using (auth_is_teacher() or auth_is_admin());

create policy teacher_manage_principal_only on teacher
  for all using (auth_is_admin_principal())
  with check (auth_is_admin_principal());

-- =============================================================================
-- POLITIQUES — ACADEMIC_YEAR / PROGRAM / LEVEL (référentiels)
-- Lecture réservée au personnel authentifié ; la lecture nécessaire au
-- formulaire public (peupler les listes déroulantes) passe par une Server
-- Action avec la clé de service, pas par un accès direct anon.
-- =============================================================================

create policy academic_year_read_staff on academic_year
  for select using (auth_is_teacher() or auth_is_admin());

create policy program_read_staff on program
  for select using (auth_is_teacher() or auth_is_admin());

create policy level_read_staff on level
  for select using (auth_is_teacher() or auth_is_admin());

create policy academic_year_write_admin on academic_year
  for all using (auth_is_admin()) with check (auth_is_admin());

create policy program_write_admin on program
  for all using (auth_is_admin()) with check (auth_is_admin());

create policy level_write_admin on level
  for all using (auth_is_admin()) with check (auth_is_admin());

-- =============================================================================
-- POLITIQUES — ACADEMIC_ASSIGNMENT
-- =============================================================================

create policy academic_assignment_select_staff on academic_assignment
  for select using (auth_is_teacher() or auth_is_admin());

-- =============================================================================
-- POLITIQUES — INTERNSHIP_REQUEST
-- Un agent voit TOUTES les demandes (confirmé par le client), pas
-- seulement les siennes. La création d'une demande (formulaire public) et
-- l'annulation par l'étudiant passent par des Server Actions avec la clé
-- de service — l'identification de l'étudiant à ce stade se fait par
-- numéro INE, pas par session.
-- =============================================================================

create policy internship_request_select_staff on internship_request
  for select using (auth_is_teacher() or auth_is_admin());

create policy internship_request_update_teacher on internship_request
  for update using (auth_is_teacher())
  with check (auth_is_teacher());

-- =============================================================================
-- POLITIQUES — DOCUMENT
-- =============================================================================

create policy document_select_staff on document
  for select using (auth_is_teacher() or auth_is_admin());

create policy document_write_teacher on document
  for all using (auth_is_teacher() or auth_is_admin())
  with check (auth_is_teacher() or auth_is_admin());

-- =============================================================================
-- POLITIQUES — ACTIVITY_LOG
-- =============================================================================

create policy activity_log_select on activity_log
  for select using (auth_is_teacher() or auth_is_admin());

-- =============================================================================
-- POLITIQUES — SETTINGS
-- =============================================================================

create policy settings_select_all on settings
  for select using (true);

create policy settings_update_admin on settings
  for update using (auth_is_admin()) with check (auth_is_admin());
