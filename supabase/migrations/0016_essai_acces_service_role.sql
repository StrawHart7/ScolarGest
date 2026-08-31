-- Correctif de `fn_proteger_dates_essai` (migration 0015).
--
-- `is_super_admin()` lit le rôle dans `app_metadata` du JWT. La clé
-- service-role n'en porte pas : la fonction renvoie donc false pour la
-- plateforme elle-même, et le trigger bloquait ses propres outils —
-- `scripts/seed-onboarding-test.ts --reset` ne pouvait plus remettre un
-- établissement de test à zéro, et aucun script d'exploitation n'aurait pu
-- corriger une date d'essai.
--
-- La clé service-role n'atteint jamais un navigateur : la reconnaître ici
-- n'ouvre rien à un tenant. C'est exactement le même raisonnement que
-- `src/lib/supabase/admin.ts`, réservé au code serveur.

create or replace function fn_proteger_dates_essai()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_jwt text;
begin
  -- Rôle PostgREST du porteur (`service_role` pour la clé de service),
  -- distinct du rôle applicatif lu par `is_super_admin()`.
  v_role_jwt := coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  );

  if is_super_admin() or v_role_jwt = 'service_role' then
    return new;
  end if;

  if old."essaiDebuteLe" is null and new."essaiDebuteLe" is not null then
    -- Démarrage : les dates sont imposées par le serveur, jamais par l'appelant.
    new."essaiDebuteLe" := now();
    new."essaiFinLe" := now() + (30 || ' days')::interval;
    return new;
  end if;

  if new."essaiDebuteLe" is distinct from old."essaiDebuteLe"
     or new."essaiFinLe" is distinct from old."essaiFinLe" then
    raise exception 'Les dates d''essai ne sont pas modifiables.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
