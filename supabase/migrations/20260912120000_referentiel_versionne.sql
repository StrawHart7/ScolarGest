-- Référentiel national : versionnement, origine, calendrier
-- ============================================================
-- Palier 1a du plan « Régie » (voir ScolarGest-Documentation/70-Console-fondateur).
--
-- **Cette migration ne change aucun comportement.** Elle est purement
-- additive : aucune colonne retirée, aucune valeur réécrite, aucun service
-- modifié. Elle pose la structure dont la bascule d'autorité (palier 1b) a
-- besoin, et peut être appliquée sans attendre l'arbitrage sur celle-ci.
--
-- Ce qu'elle corrige : `coefficient_officiel` ne portait **ni année ni
-- version**. La décision produit est que les écoles gardent leur passé et
-- basculent à l'année suivante — impossible à tenir sur une table dont la
-- correction d'une valeur réécrit le barème de toutes les années, y compris
-- closes. C'est la famille de bug qui avait faussé la moyenne annuelle :
-- rééditer un ancien bulletin doit redonner les mêmes chiffres.


-- ============================================================
-- Origine d'un coefficient
-- ============================================================
-- Le référentiel doit pouvoir dire **ce qu'il ne sait pas**. Sans cela, un
-- niveau non couvert — la Seconde aujourd'hui, les huit séries techniques
-- toujours — bloquerait les établissements concernés le jour où le national
-- devient l'autorité.
--
--   OFFICIEL   : repris d'un document ministériel identifié (voir `source`).
--   CONVERGENT : aucune source officielle, mais plusieurs écoles ont saisi
--                indépendamment la même valeur. Candidat, pas vérité.
--   LOCAL      : valeur propre à un établissement. N'apparaît jamais dans
--                cette table — elle vit dans `coefficient_matiere`. Présente
--                dans l'énumération pour que le résolveur du palier 1b
--                renvoie une origine uniforme quelle que soit la provenance.
create type origine_coefficient as enum ('OFFICIEL', 'CONVERGENT', 'LOCAL');


-- ============================================================
-- coefficient_officiel : validité et origine
-- ============================================================
-- `valableDe` et `valableJusqua` portent l'**année de début** de l'année
-- scolaire : 2026 signifie 2026-2027. Un entier plutôt qu'une référence à
-- `annee_scolaire`, qui est une table **par établissement** — le barème
-- national ne peut pas pointer vers l'année scolaire d'une école en
-- particulier.
--
-- Borne haute exclue : une valeur close le 2027 reste valable pour 2026-2027
-- et cesse de l'être à la rentrée 2027. Corriger un coefficient ne se fait
-- donc jamais par un UPDATE : on ferme la ligne en vigueur et on en insère
-- une nouvelle. L'historique se conserve tout seul.
alter table coefficient_officiel
  add column "valableDe" int not null default 2020,
  add column "valableJusqua" int,
  add column confiance origine_coefficient not null default 'OFFICIEL',
  add column source text;

-- Les 85 lignes existantes proviennent des documents ministériels dépouillés
-- en migration 0020. Elles sont donc OFFICIEL, et valables « depuis toujours »
-- : aucun bulletin passé n'a été calculé depuis cette table — les écoles
-- travaillent sur les copies de `coefficient_matiere` — donc les antidater ne
-- réécrit rien.
update coefficient_officiel
   set source = 'Documents ministériels dépouillés en migration 0020'
 where source is null;

-- Les valeurs par défaut sont retirées **après** le remplissage. Une valeur
-- par défaut qui subsiste sur une colonne de validité finit par produire une
-- ligne silencieusement valable depuis 2020 alors que personne ne l'a voulu.
alter table coefficient_officiel
  alter column "valableDe" drop default,
  alter column confiance drop default;

alter table coefficient_officiel
  add constraint coefficient_officiel_validite_coherente
    check ("valableJusqua" is null or "valableJusqua" > "valableDe"),
  -- LOCAL ne peut pas apparaître ici : cette table **est** le national.
  add constraint coefficient_officiel_origine_nationale
    check (confiance <> 'LOCAL');

comment on column coefficient_officiel."valableDe" is
  'Année de début de la première année scolaire couverte. 2026 = 2026-2027.';
comment on column coefficient_officiel."valableJusqua" is
  'Année de début de la première année scolaire NON couverte, ou NULL si toujours en vigueur. Borne exclue.';
comment on column coefficient_officiel.confiance is
  'OFFICIEL = document ministériel identifié. CONVERGENT = candidat issu de la convergence des écoles, non ratifié.';
comment on column coefficient_officiel.source is
  'Référence de la pièce justificative. Obligatoire en pratique pour passer CONVERGENT en OFFICIEL.';

-- Les deux index partiels de 0020 deviennent faux : ils interdiraient de
-- fermer une ligne et d'en ouvrir une nouvelle pour la même matière. Ils sont
-- reconstruits avec la validité.
--
-- Toujours deux index et non une contrainte unique : en Postgres deux NULL
-- sont distincts, donc une contrainte incluant `serieId` ne protégerait rien
-- au collège, où il est toujours nul. Même piège que 0018 et 0020.
drop index if exists coefficient_officiel_avec_serie;
drop index if exists coefficient_officiel_sans_serie;

create unique index coefficient_officiel_avec_serie
  on coefficient_officiel ("matiereOfficielleId", "niveauId", "serieId", "valableDe")
  where "serieId" is not null;
create unique index coefficient_officiel_sans_serie
  on coefficient_officiel ("matiereOfficielleId", "niveauId", "valableDe")
  where "serieId" is null;

-- ⚠ À LIRE AVANT D'INSÉRER UNE SECONDE VERSION
-- Les services actuels (`src/services/matiere-officielle.ts`) lisent cette
-- table **sans filtrer sur la validité** — ils n'en avaient pas besoin, il
-- n'existait qu'un barème. Insérer une seconde version avant que le palier 1b
-- ait posé le filtre ferait remonter deux lignes là où le code en attend une.
-- Tant que 1b n'est pas livré : une seule version en vigueur.


-- ============================================================
-- calendrier_national
-- ============================================================
-- Le découpage de l'année scolaire est **national** : il est fixé chaque année
-- par décision ministérielle et son respect est contrôlé (arrêté 1049,
-- art. 50). Le produit ne le modélisait nulle part — `periode` est une
-- énumération sans dates, et `annee_scolaire` ne porte que début et fin.
--
-- **Décision du 2026-09-12 : ce calendrier n'a aucune incidence sur le
-- produit.** Il alimente un rappel, rien d'autre. Il ne gèle aucune saisie, ne
-- verrouille aucun bulletin, ne conditionne aucune écriture. Si un jour
-- quelqu'un veut lui donner un effet, c'est une décision produit à reprendre,
-- pas une évidence à déduire de l'existence de la table.
create table calendrier_national (
  id uuid primary key default gen_random_uuid(),
  -- Même convention que la validité ci-dessus : 2026 = année scolaire
  -- 2026-2027.
  "anneeDebut" int not null,
  periode periode not null,
  "dateDebut" date not null,
  "dateFin" date not null,
  -- Référence de la décision ministérielle, par exemple
  -- « décision n°125/2026/MEN/CAB/SG ».
  reference text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("anneeDebut", periode),
  constraint calendrier_national_periode_coherente check ("dateFin" > "dateDebut")
);

comment on table calendrier_national is
  'Découpage officiel de l''année scolaire. Sert un rappel et rien d''autre : aucune incidence sur les saisies, les bulletins ou les écritures (décision du 2026-09-12).';

create index idx_calendrier_national_annee on calendrier_national("anneeDebut");

create trigger trg_calendrier_national_updated
  before update on calendrier_national
  for each row execute function touch_updated_at();

-- Catalogue national : lisible par tous, comme `matiere_officielle` et
-- `coefficient_officiel`. Aucune policy d'écriture — donc aucune école ne peut
-- y écrire. Les écritures passeront par le rôle de la Régie.
alter table calendrier_national enable row level security;
create policy calendrier_national_lecture on calendrier_national for select using (true);


-- ============================================================
-- La règle programme / série, écrite là où on la lira
-- ============================================================
-- `programme_etablissement` est unique sur (établissement, niveau, matière) et
-- **ne connaît pas la série**. Le programme national, lui, distingue les
-- séries au lycée.
--
-- Ce n'est pas un oubli et il ne faut pas « corriger » l'absence de `serieId` :
-- la répartition du travail est que **le programme dit le niveau, et le
-- coefficient dit la série**. Une matière absente d'une série n'y a tout
-- simplement pas de ligne dans `coefficient_officiel` ; le moteur l'écarte
-- (`calcul-moyennes` ignore tout coefficient nul ou absent).
--
-- Ajouter `serieId` ici obligerait à dupliquer chaque ligne de programme par
-- série et ferait diverger deux sources sur la même question.
comment on table programme_etablissement is
  'Matières enseignées par niveau. Ne porte PAS la série, délibérément : le programme dit le niveau, le coefficient dit la série (voir migration 20260912120000).';
