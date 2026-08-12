-- =============================================================================
-- StagePermit Digital — Liste officielle des chefs de département
--
-- Rend réelle la vérification "nom du responsable de département" côté
-- formulaire — jusqu'ici purement déclarative, sans liste à laquelle se
-- comparer (voir LOT 04). Liste transmise par le client
-- (Chefs_de_departement_et_directeurs_de_programme_UL.pdf), avec deux
-- corrections apportées : Alpha Oumar Bah remplace Faya Michel Kamano au
-- département Mathématiques ; ESS = Économie Sociale et Solidaire.
--
-- N'ajoute PAS de blocage automatique à la soumission — une discordance
-- est un signal pour l'agent, jamais un rejet silencieux (cohérent avec
-- le principe déjà acté : pas de promesse de contrôle que l'université ne
-- peut garantir, la liste peut devenir obsolète).
-- =============================================================================

create extension if not exists "unaccent";

create table department_head (
  id uuid primary key default gen_random_uuid(),
  faculte text not null,
  departement text not null,
  chef_departement text not null,
  directeur_programme text not null,
  constraint department_head_departement_unique unique (departement)
);

comment on table department_head is
  'Référentiel officiel transmis par le client, à tenir à jour manuellement. '
  'Utilisé uniquement pour signaler une discordance à l''agent — jamais pour '
  'rejeter automatiquement une demande.';

insert into department_head (faculte, departement, chef_departement, directeur_programme) values
  ('FST', 'Mathématiques', 'Alpha Oumar Bah', 'Mariama Diallo'),
  ('FST', 'Économie-Statistique', 'Mamadou Baïlo Baldé', 'Boubacar Bah'),
  ('FST', 'Biologie', 'Aboubacar Diakité', 'Mamadou Oury Diallo'),
  ('FST', 'Informatique', 'Abdoulaye Sow', 'Koliko Delamou'),
  ('FST', 'MIAGE', 'Abdoulaye Dramé', 'Mohamed Keita'),
  ('FST', 'Énergie photovoltaïque', 'Mamadou Pathé Barry', 'Mohamed Makanera'),
  ('FLSH', 'Sociologie', 'Bernard Leno', 'Sâa Cyprien Malano'),
  ('FLSH', 'Langue Anglaise', 'Gansilé Maomou', 'Ekany Maomou'),
  ('FLSH', 'Lettres Modernes', 'Mamadou Tahirou Diallo', 'Elhadj Senkoun Faro'),
  ('FLSH', 'Langue Arabe', 'Thierno Alpha Oumar Haïdara', 'Ibrahima Sory Diop'),
  ('FSAG', 'Économie', 'Mamadou Oury Daka Diallo', 'Mamadi Camara'),
  ('FSAG', 'Gestion', 'Mamadou Pethé Baldé', 'Oumar Diaby'),
  ('FSAG', 'Administration publique', 'Moussa Sylla', 'Mamadou Yaya Diallo'),
  ('FSAG', 'Économie Sociale et Solidaire', 'Oumar Diouldé Diallo', 'Bangaly Kanté');

alter table department_head enable row level security;

create policy department_head_read_all on department_head
  for select using (true);

create policy department_head_write_admin on department_head
  for all using (auth_is_admin()) with check (auth_is_admin());

-- =============================================================================
-- Résultat de la vérification, stocké sur la demande — signal pour l'agent,
-- jamais un filtre automatique.
-- =============================================================================

create type verification_responsable_resultat as enum ('correspond', 'ne_correspond_pas', 'departement_inconnu');

alter table internship_request
  add column responsable_declare text,
  add column verification_responsable verification_responsable_resultat;

-- =============================================================================
-- Fonction de comparaison — normalise accents/casse/espaces avant de
-- comparer, pour éviter de pénaliser des variantes d'écriture légitimes.
-- =============================================================================

create or replace function verifier_responsable_departement(p_departement text, p_nom_declare text)
returns verification_responsable_resultat
language plpgsql
stable
as $$
declare
  v_row department_head%rowtype;
  v_dept_norm text := lower(trim(unaccent(p_departement)));
  v_nom_norm text := lower(trim(unaccent(p_nom_declare)));
begin
  select * into v_row from department_head
  where lower(trim(unaccent(departement))) = v_dept_norm;

  if not found then
    return 'departement_inconnu';
  end if;

  if lower(trim(unaccent(v_row.chef_departement))) = v_nom_norm
     or lower(trim(unaccent(v_row.directeur_programme))) = v_nom_norm then
    return 'correspond';
  end if;

  return 'ne_correspond_pas';
end;
$$;
