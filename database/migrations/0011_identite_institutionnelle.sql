-- =============================================================================
-- StagePermit Digital — Identité institutionnelle
--
-- Aucune table ne portait ces informations jusqu'ici — elles étaient
-- codées en dur dans le générateur de PDF (lib/pdf/documents.tsx).
-- Cette migration crée l'enregistrement éditable ; le générateur de PDF
-- n'est PAS encore branché dessus (reste à faire séparément).
-- =============================================================================

create table identite_institutionnelle (
  id uuid primary key default gen_random_uuid(),
  etablissement text not null default 'Université de Labé',
  service text not null default 'Service Conseil et Aide à l''Insertion Professionnelle',
  signataire text not null default 'Dr Amara KEITA',
  fonction text not null default 'Chef du SCAIP-UL',
  email_professionnel text not null default 'amara.keita@univ-labe.edu.gn',
  telephone text not null default '+224 61131 08 01 / +224 622370191'
);

insert into identite_institutionnelle (etablissement) values ('Université de Labé');

alter table identite_institutionnelle enable row level security;

create policy identite_read_all on identite_institutionnelle
  for select using (true);

create policy identite_write_admin on identite_institutionnelle
  for update using (auth_is_admin()) with check (auth_is_admin());
