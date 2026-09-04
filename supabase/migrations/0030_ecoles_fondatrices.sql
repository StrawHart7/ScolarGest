-- Programme « ecoles fondatrices ».
--
-- Decision commerciale du 2026-09-04 : plutot que de chercher du volume avec
-- un essai gratuit, selectionner une dizaine d'etablissements a tarif
-- preferentiel, les accompagner, et transformer leur reussite en preuve
-- commerciale.
--
-- **Ce n'est pas une refonte de la facturation.** Tout ce qui compte existait
-- deja : `plan_abonnement` est une table et non une constante, et
-- `abonnement_etablissement.montantTotal` est fige sur la periode depuis la
-- migration `0015` — une fondatrice garde donc ce qu'elle a paye meme si le
-- catalogue public triple. Ce qui manquait n'etait pas de la mecanique, c'etait
-- du **vocabulaire** : rien ne savait dire « cette ecole est fondatrice », ni
-- « ce plan n'est pas public », ni « il reste N places ».

-- ---------------------------------------------------------------- regime ---

do $$ begin
  create type regime_tarifaire as enum ('STANDARD', 'FONDATRICE');
exception when duplicate_object then null;
end $$;

alter table etablissement
  add column if not exists "regimeTarifaire" regime_tarifaire not null default 'STANDARD',
  add column if not exists "fondatriceDepuisLe" timestamptz,
  add column if not exists "tarifFondateurMensuel" numeric(12, 2);

-- Le regime vit sur l'etablissement, pas sur l'abonnement.
--
-- Une fondatrice le reste au renouvellement. Porte par la periode, il faudrait
-- le re-decider chaque mois, et un renouvellement distrait ferait basculer
-- silencieusement un partenaire fondateur au tarif public. C'est une
-- **identite**, pas une transaction.
comment on column etablissement."regimeTarifaire" is
  'STANDARD (catalogue public) ou FONDATRICE (programme de lancement). Survit aux renouvellements.';

-- Le tarif est fige **sur l''ecole**, pas relu dans le catalogue.
--
-- L''engagement commercial est « tarif preferentiel garanti a vie ». Le relire
-- dans `plan_abonnement` a chaque renouvellement le rendrait revocable d''un
-- UPDATE : le jour ou le prix fondateur serait revu pour de nouvelles ecoles,
-- les anciennes suivraient sans que personne ne l''ait voulu. Meme raisonnement
-- que l''historisation des tarifs scolaires et des coefficients.
comment on column etablissement."tarifFondateurMensuel" is
  'Tarif mensuel fige a l''admission au programme fondateur. Garanti a vie : jamais relu depuis plan_abonnement.';

-- --------------------------------------------------------------- le plan ---

alter table plan_abonnement
  add column if not exists code text,
  add column if not exists "parCycle" boolean not null default true,
  add column if not exists public boolean not null default true,
  add column if not exists "placesMax" integer;

-- `nom` est un libelle, et un libelle finit par etre reformule par le
-- marketing. L'`on conflict (nom)` de la migration `0015` creerait alors un
-- doublon au lieu de mettre a jour. `code` est l'identifiant stable.
update plan_abonnement set code = 'MENSUEL' where nom = 'Mensuel' and code is null;
update plan_abonnement set code = 'ANNUEL' where nom = 'Annuel' and code is null;
update plan_abonnement set code = upper(regexp_replace(nom, '[^a-zA-Z0-9]+', '_', 'g'))
  where code is null;

alter table plan_abonnement alter column code set not null;
create unique index if not exists plan_abonnement_code_unique on plan_abonnement(code);

-- Le plan fondateur : forfaitaire, non public, dix places.
--
-- `parCycle = false` est la difference de fond avec le catalogue standard, qui
-- facture 10 000 F **par cycle** — un complexe college-lycee y paie 20 000. Le
-- tarif fondateur est un forfait par etablissement, quel que soit le nombre de
-- cycles. C'est assume : c'est une offre de lancement, pas une grille.
insert into plan_abonnement (nom, code, duree, prix, "parCycle", public, "placesMax")
values ('Fondateur', 'FONDATEUR', 'MOIS', 15000, false, false, 10)
on conflict (nom) do update set
  code = excluded.code,
  prix = excluded.prix,
  "parCycle" = excluded."parCycle",
  public = excluded.public,
  "placesMax" = excluded."placesMax";

comment on column plan_abonnement."parCycle" is
  'true : le prix est multiplie par le nombre de cycles exploites. false : forfait par etablissement (plan fondateur).';
comment on column plan_abonnement.public is
  'false : le plan n''apparait jamais sur la page de tarifs publique. On y souscrit uniquement par la console SUPER_ADMIN.';
comment on column plan_abonnement."placesMax" is
  'Nombre maximal d''etablissements admis sur ce plan. NULL = illimite. Une donnee, pas une constante : le programme peut passer a 12 sans migration.';

-- --------------------------------------------------------- les dix places ---

/*
 * Le nombre de fondatrices est verrouille en base, pas dans l'ecran.
 *
 * Un ecran qui compte avant d'admettre laisse passer deux admissions
 * simultanees, et la rarete est tout l'argument du programme : « limite a dix
 * ecoles » doit etre vrai. Meme doctrine que `cycle.disponible` — la liste
 * informe, l'ecriture decide.
 *
 * Le `for update` sur la ligne du plan serialise les admissions concurrentes :
 * sans lui, deux transactions liraient le meme compte et passeraient toutes
 * les deux.
 *
 * Le declencheur ne se reveille que lorsqu'une ecole *devient* fondatrice.
 * Sans cette condition, toute mise a jour d'un etablissement deja fondateur —
 * un changement de nom, une suspension — reverifierait la limite et echouerait
 * une fois les dix places prises.
 */
create or replace function fn_limiter_ecoles_fondatrices() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  places_max integer;
  deja integer;
begin
  if new."regimeTarifaire" is distinct from 'FONDATRICE' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old."regimeTarifaire" = 'FONDATRICE' then
    return new;
  end if;

  select "placesMax" into places_max from plan_abonnement where code = 'FONDATEUR' for update;
  if places_max is null then
    return new;
  end if;

  select count(*) into deja
  from etablissement
  where "regimeTarifaire" = 'FONDATRICE' and id <> new.id;

  if deja >= places_max then
    raise exception 'Le programme fondateur est complet (% places). Modifiez placesMax du plan FONDATEUR pour l''elargir.', places_max
      using errcode = 'check_violation';
  end if;

  if new."fondatriceDepuisLe" is null then
    new."fondatriceDepuisLe" := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limiter_ecoles_fondatrices on etablissement;
create trigger trg_limiter_ecoles_fondatrices
  before insert or update of "regimeTarifaire" on etablissement
  for each row execute function fn_limiter_ecoles_fondatrices();

-- ------------------------------------------------------ compteur public ---

-- Le compteur de places restantes s'affiche sur la page d'accueil, qui
-- s'adresse a des visiteurs anonymes.
--
-- **Aucune policy n'est ajoutee ici, deliberement.** `plan_abonnement` porte
-- deja `plan_abonnement_read_all` et un jeu de policies qui fonctionne ; y
-- superposer une regle pour un cas de bord marketing risquerait de casser une
-- lecture existante pour un gain nul. Le comptage se fait cote serveur avec la
-- cle service-role, dans une fonction nominativement exemptee de garde
-- (`plateforme.getPlacesFondatrices`), et ne renvoie que deux entiers : aucune
-- donnee d'etablissement ne transite par la page publique.
