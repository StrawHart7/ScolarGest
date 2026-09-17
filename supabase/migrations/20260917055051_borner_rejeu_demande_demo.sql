-- `demande_demo` est la seule table du produit ouverte en ecriture a `anon`,
-- et c'est voulu : le formulaire de la page d'accueil s'adresse a des
-- visiteurs. Les longueurs y sont deja bornees par
-- `demande_demo_longueurs`. Restaient deux choses.
--
-- La cle anon est publique par construction — elle est dans le bundle client.
-- `submitDemandeDemo` ne peut donc pas porter la garde : c'est une Server
-- Action, et l'appelant la saute en parlant a PostgREST directement. Meme
-- raisonnement que pour les roles : la borne descend en base.

-- 1. Une adresse qui ressemble a une adresse.
--
-- Volontairement laxiste : refuser un prospect reel pour une adresse
-- inhabituelle coute plus cher que d'accepter une adresse fausse, qu'un humain
-- verra de toute facon. Les dix-huit demandes existantes la passent toutes —
-- verifie avant de poser la contrainte, sinon elle aurait echoue en bloc.
alter table public.demande_demo
  add constraint demande_demo_email_plausible
  check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- 2. Anti-rejeu, et non anti-volume.
--
-- **Un plafond global serait une arme retournee contre le commerce** : il
-- suffirait de le remplir pour empecher toute vraie ecole de demander une
-- demo. On borne donc la repetition d'un meme demandeur. Un attaquant
-- contourne en variant les adresses — mais il ne peut alors plus bloquer
-- personne d'autre, et c'est precisement ce qu'on protege : la file des
-- prospects est l'ecran ou se decide le chiffre d'affaires.
--
-- Ca arrete le double-clic, le rejeu de formulaire et le robot naif.
create or replace function public.fn_borner_demande_demo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if exists (
    select 1 from public.demande_demo d
    where lower(d.email) = lower(new.email)
      and d."createdAt" > now() - interval '5 minutes'
  ) then
    -- `23505` et non un code quelconque : les services du depot reconnaissent
    -- deja un doublon par ce code Postgres autant que par son texte.
    raise exception 'Une demande vient deja d''etre enregistree pour cette adresse.'
      using errcode = '23505';
  end if;
  return new;
end;
$$;

-- Un declencheur ne s'appelle pas en RPC, mais le laisser octroye le ferait
-- figurer dans l'API publique sans aucune raison.
revoke execute on function public.fn_borner_demande_demo() from anon, authenticated;

create trigger trg_borner_demande_demo
  before insert on public.demande_demo
  for each row execute function public.fn_borner_demande_demo();

-- Sert le declencheur ci-dessus, appele a chaque depot.
create index if not exists idx_demande_demo_email_date
  on public.demande_demo (lower(email), "createdAt" desc);
