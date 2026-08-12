-- =============================================================================
-- StagePermit Digital — Jusqu'à deux admins principaux, jamais zéro
--
-- Remplace la contrainte "exactement un" par "entre un et deux" —
-- permet une vraie redondance en cas d'indisponibilité (accident,
-- mutation, incapacité) sans dépendre d'une action de la personne
-- devenue injoignable, ni d'une intervention Supabase en dehors de
-- l'application.
--
-- Un index unique ne peut pas exprimer "au plus deux" — remplacé par un
-- déclencheur qui compte et refuse au-delà de deux, et qui refuse aussi
-- de faire tomber le compte à zéro.
-- =============================================================================

drop index if exists teacher_admin_principal_unique;

create or replace function verifier_nombre_admin_principaux()
returns trigger
language plpgsql
as $$
declare
  v_compte integer;
begin
  select count(*) into v_compte from teacher where est_admin_principal = true;

  if new.est_admin_principal = true and v_compte > 2 then
    raise exception 'Il ne peut pas y avoir plus de deux administrateurs principaux.';
  end if;

  if old.est_admin_principal = true and new.est_admin_principal = false and v_compte < 1 then
    raise exception 'Il doit toujours rester au moins un administrateur principal.';
  end if;

  return new;
end;
$$;

create trigger trg_verifier_nombre_admin_principaux
  before update on teacher
  for each row
  when (old.est_admin_principal is distinct from new.est_admin_principal)
  execute function verifier_nombre_admin_principaux();

-- Fonction d'ajout — accorde le statut à un second agent sans retirer le
-- premier, refusée si deux existent déjà.
create or replace function ajouter_admin_principal(p_agent_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_compte integer;
begin
  select count(*) into v_compte from teacher where est_admin_principal = true;
  if v_compte >= 2 then
    raise exception 'Il y a déjà deux administrateurs principaux — retirez-en un avant d''en ajouter un autre.';
  end if;

  update teacher set est_admin_principal = true, est_admin = true where id = p_agent_id;
  if not found then
    raise exception 'Agent introuvable.';
  end if;
end;
$$;

-- Fonction de retrait — refusée si elle ferait tomber le compte à zéro
-- (le déclencheur ci-dessus le refuserait de toute façon, mais un message
-- clair vaut mieux qu'une erreur de contrainte brute).
create or replace function retirer_admin_principal(p_agent_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_compte integer;
begin
  select count(*) into v_compte from teacher where est_admin_principal = true;
  if v_compte <= 1 then
    raise exception 'Impossible de retirer le dernier administrateur principal.';
  end if;

  update teacher set est_admin_principal = false where id = p_agent_id;
  if not found then
    raise exception 'Agent introuvable.';
  end if;
end;
$$;
