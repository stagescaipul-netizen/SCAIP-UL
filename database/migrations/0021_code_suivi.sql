-- =============================================================================
-- StagePermit Digital — Code de suivi à 6 chiffres
--
-- Généré automatiquement à chaque nouvelle demande, avant même la
-- validation — permet à l'étudiant de suivre sa demande dès la
-- soumission, indépendamment de l'email (qui a montré des limites de
-- délivrabilité avec plusieurs fournisseurs testés).
--
-- Généré en base, pas côté application, pour garantir l'unicité sans
-- boucle de nouvelle tentative dans le code TypeScript.
-- =============================================================================

alter table internship_request add column code_suivi text;

create unique index internship_request_code_suivi_unique on internship_request (code_suivi);

create or replace function generer_code_suivi()
returns trigger
language plpgsql
as $$
declare
  v_code text;
  v_existe boolean;
begin
  if new.code_suivi is not null then
    return new;
  end if;

  loop
    v_code := lpad((floor(random() * 1000000))::text, 6, '0');
    select exists(select 1 from internship_request where code_suivi = v_code) into v_existe;
    exit when not v_existe;
  end loop;

  new.code_suivi := v_code;
  return new;
end;
$$;

create trigger trg_generer_code_suivi
  before insert on internship_request
  for each row execute function generer_code_suivi();
