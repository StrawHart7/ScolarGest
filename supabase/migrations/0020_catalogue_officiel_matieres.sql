-- Catalogue officiel des matières et de leurs coefficients.
--
-- Décision produit du 2026-09-01, sur documents du Ministère des Enseignements
-- Primaire, Secondaire, Technique et de l'Artisanat (Direction de
-- l'Enseignement Secondaire Général), applicables à compter de 2022-2023.
--
-- **Les coefficients ne sont pas une donnée d'établissement.** Ils sont fixés
-- au niveau national. Jusqu'ici le Directeur les saisissait un par un — une
-- grille niveau × matière à remplir avant de pouvoir éditer le moindre
-- bulletin, sans qu'il ait la moindre latitude sur les valeurs.
--
-- Ces tables sont donc des **catalogues système**, sans `etablissementId`, au
-- même titre que `cycle`, `niveau` et `serie`.
--
-- ============================================================
-- Ce que le catalogue ne couvre pas, volontairement
-- ============================================================
--
-- 1. **Les séries techniques** (E, F1 à F4, G1 à G3) n'apparaissent dans aucun
--    des deux documents, qui ne traitent que l'enseignement général. Aucune
--    ligne n'est semée pour elles : l'établissement continue de saisir ses
--    coefficients à la main, comme avant.
--
-- 2. **La Seconde** est absente pour une autre raison. Les totaux officiels du
--    document (20 pour la série A, 19 pour C/D) ne se recoupent pas avec la
--    lecture des cellules, qui donne 21 et 20 — un écart de +1 sur les deux
--    colonnes, donc une seule ligne mal lue. Cinq lignes peuvent l'expliquer et
--    rien ne permet de les départager sur une image.
--    Semer une valeur dont on sait qu'elle est fausse quelque part ne ferait
--    pas planter l'application : elle produirait des bulletins faux, signés et
--    remis aux familles. La Seconde reste donc en saisie manuelle jusqu'à
--    vérification sur le document papier. Dix colonnes sur douze sont semées et
--    vérifiées.
--
-- 3. **Les matières sans coefficient** (Dessin, Musique, Langues nationales,
--    Enseignement ménager) figurent au catalogue — elles ont un volume horaire
--    officiel — mais **sans aucune ligne de coefficient**. L'absence de ligne
--    est l'information. Une école qui les enseigne leur donne le coefficient
--    qu'elle veut, jamais zéro (voir plus bas).

-- ============================================================
-- matiere_officielle
-- ============================================================
-- `cycleId` fait partie de l'identité : « Physique-Chimie-Technologie » au
-- collège et « Physique-Chimie » au lycée sont deux matières distinctes du
-- programme, pas deux libellés d'une même matière. Idem pour « Anglais » et
-- « Langue Vivante 1 ».
create table matiere_officielle (
  id uuid primary key default gen_random_uuid(),
  "cycleId" uuid not null references cycle(id),
  code text not null,
  nom text not null,
  "ordreAffichage" int not null default 0,
  "createdAt" timestamptz not null default now(),
  unique ("cycleId", code)
);

-- Catalogue système : lisible par tous, écrit par personne via l'application.
alter table matiere_officielle enable row level security;
create policy matiere_officielle_lecture on matiere_officielle for select using (true);

-- ============================================================
-- coefficient_officiel
-- ============================================================
-- `serieId` est nul au collège, où le programme ne se différencie pas.
create table coefficient_officiel (
  id uuid primary key default gen_random_uuid(),
  "matiereOfficielleId" uuid not null references matiere_officielle(id),
  "niveauId" uuid not null references niveau(id),
  "serieId" uuid references serie(id),
  -- Une matière au barème national a toujours un poids réel. L'absence de
  -- coefficient se dit par l'absence de ligne, jamais par un zéro.
  coefficient numeric(5, 2) not null check (coefficient > 0),
  "createdAt" timestamptz not null default now()
);

-- Deux index partiels et non une contrainte unique à trois colonnes : en
-- Postgres, deux NULL sont distincts, donc `unique(matiere, niveau, serie)` ne
-- protégerait rien au collège, où `serieId` est toujours nul. Même piège que
-- l'index de l'emploi du temps (migration 0018).
create unique index coefficient_officiel_avec_serie
  on coefficient_officiel ("matiereOfficielleId", "niveauId", "serieId")
  where "serieId" is not null;
create unique index coefficient_officiel_sans_serie
  on coefficient_officiel ("matiereOfficielleId", "niveauId")
  where "serieId" is null;

alter table coefficient_officiel enable row level security;
create policy coefficient_officiel_lecture on coefficient_officiel for select using (true);

-- ============================================================
-- Rattachement côté établissement
-- ============================================================
-- `NULL` = matière ajoutée librement par l'école, dont elle fixe le
-- coefficient. Non nul = instance locale d'une matière du programme national.
alter table matiere add column "matiereOfficielleId" uuid references matiere_officielle(id);

-- Une école ne peut pas instancier deux fois la même matière officielle. Index
-- partiel : les matières libres, elles, ne sont contraintes que par
-- `unique("etablissementId", nom)` qui existe déjà.
create unique index matiere_officielle_unique_par_etablissement
  on matiere ("etablissementId", "matiereOfficielleId")
  where "matiereOfficielleId" is not null;

-- ============================================================
-- Semis — collège
-- ============================================================
with c as (select id from cycle where nom = 'COLLEGE')
insert into matiere_officielle ("cycleId", code, nom, "ordreAffichage")
select c.id, v.code, v.nom, v.ordre
from c, (values
  ('FRA',    'Français',                            1),
  ('HG',     'Histoire-Géographie',                 2),
  ('ECM',    'Éducation Civique et Morale',         3),
  ('ANG',    'Anglais',                             4),
  ('MATH',   'Mathématiques',                       5),
  ('PCT',    'Physique-Chimie-Technologie',         6),
  ('SVT',    'Sciences de la Vie et de la Terre',   7),
  ('EPS',    'Éducation Physique et Sportive',      8),
  ('DESSIN', 'Dessin',                              9),
  ('MUS',    'Musique',                            10),
  ('LN',     'Langues Nationales',                 11),
  ('EM',     'Enseignement Ménager',               12)
) as v(code, nom, ordre)
on conflict ("cycleId", code) do nothing;

-- Coefficients du premier cycle. Totaux officiels : 9, 9, 18, 18.
insert into coefficient_officiel ("matiereOfficielleId", "niveauId", "serieId", coefficient)
select mo.id, n.id, null, v.coefficient
from (values
  ('FRA',  '6ème', 2), ('FRA',  '5ème', 2), ('FRA',  '4ème', 3), ('FRA',  '3ème', 3),
  ('HG',   '6ème', 1), ('HG',   '5ème', 1), ('HG',   '4ème', 2), ('HG',   '3ème', 2),
  ('ECM',  '6ème', 1), ('ECM',  '5ème', 1), ('ECM',  '4ème', 2), ('ECM',  '3ème', 2),
  ('ANG',  '6ème', 1), ('ANG',  '5ème', 1), ('ANG',  '4ème', 2), ('ANG',  '3ème', 2),
  ('MATH', '6ème', 1), ('MATH', '5ème', 1), ('MATH', '4ème', 3), ('MATH', '3ème', 3),
  ('PCT',  '6ème', 1), ('PCT',  '5ème', 1), ('PCT',  '4ème', 3), ('PCT',  '3ème', 3),
  ('SVT',  '6ème', 1), ('SVT',  '5ème', 1), ('SVT',  '4ème', 2), ('SVT',  '3ème', 2),
  ('EPS',  '6ème', 1), ('EPS',  '5ème', 1), ('EPS',  '4ème', 1), ('EPS',  '3ème', 1)
) as v(code, niveau, coefficient)
join cycle cy on cy.nom = 'COLLEGE'
join matiere_officielle mo on mo."cycleId" = cy.id and mo.code = v.code
join niveau n on n."cycleId" = cy.id and n.nom = v.niveau;

-- ============================================================
-- Semis — lycée
-- ============================================================
with c as (select id from cycle where nom = 'LYCEE')
insert into matiere_officielle ("cycleId", code, nom, "ordreAffichage")
select c.id, v.code, v.nom, v.ordre
from c, (values
  ('PHILO',  'Philosophie',                          1),
  ('FRA',    'Français',                             2),
  ('HG',     'Histoire-Géographie',                  3),
  ('ECM',    'Éducation Civique et Morale',          4),
  ('LV1',    'Langue Vivante 1 (Anglais)',           5),
  ('LV2',    'Langue Vivante 2 (Allemand/Espagnol)', 6),
  ('MATH',   'Mathématiques',                        7),
  ('PC',     'Physique-Chimie',                      8),
  ('SVT',    'Sciences de la Vie et de la Terre',    9),
  ('EPS',    'Éducation Physique et Sportive',      10),
  ('DESSIN', 'Dessin',                              11),
  ('MUS',    'Musique',                             12),
  ('EM',     'Enseignement Ménager',                13)
) as v(code, nom, ordre)
on conflict ("cycleId", code) do nothing;

-- Coefficients du second cycle, Premières et Terminales uniquement.
-- La colonne « A » du ministère est la série A4, seule série A du catalogue
-- (A1, A2 et B ont été écartées avec l'établissement, migration 0010).
--
-- Deux absences qui sont des informations, pas des oublis :
--   - la Philosophie n'a pas de ligne en Première (case grisée) ;
--   - la Langue Vivante 2 n'existe qu'en série littéraire A4.
--
-- Totaux officiels : 1ère A4 19, 1ère C 20, 1ère D 19,
--                    Tle A4 22, Tle C 22, Tle D 21.
insert into coefficient_officiel ("matiereOfficielleId", "niveauId", "serieId", coefficient)
select mo.id, n.id, s.id, v.coefficient
from (values
  -- Premières
  ('FRA',   '1ère', 'A4', 4), ('FRA',   '1ère', 'C', 2), ('FRA',   '1ère', 'D', 2),
  ('HG',    '1ère', 'A4', 3), ('HG',    '1ère', 'C', 2), ('HG',    '1ère', 'D', 2),
  ('ECM',   '1ère', 'A4', 2), ('ECM',   '1ère', 'C', 2), ('ECM',   '1ère', 'D', 2),
  ('LV1',   '1ère', 'A4', 3), ('LV1',   '1ère', 'C', 2), ('LV1',   '1ère', 'D', 2),
  ('LV2',   '1ère', 'A4', 2),
  ('MATH',  '1ère', 'A4', 2), ('MATH',  '1ère', 'C', 5), ('MATH',  '1ère', 'D', 3),
  ('PC',    '1ère', 'A4', 1), ('PC',    '1ère', 'C', 4), ('PC',    '1ère', 'D', 3),
  ('SVT',   '1ère', 'A4', 1), ('SVT',   '1ère', 'C', 2), ('SVT',   '1ère', 'D', 4),
  ('EPS',   '1ère', 'A4', 1), ('EPS',   '1ère', 'C', 1), ('EPS',   '1ère', 'D', 1),
  -- Terminales
  ('PHILO', 'Tle',  'A4', 4), ('PHILO', 'Tle',  'C', 2), ('PHILO', 'Tle',  'D', 2),
  ('FRA',   'Tle',  'A4', 3), ('FRA',   'Tle',  'C', 2), ('FRA',   'Tle',  'D', 2),
  ('HG',    'Tle',  'A4', 3), ('HG',    'Tle',  'C', 2), ('HG',    'Tle',  'D', 2),
  ('ECM',   'Tle',  'A4', 2), ('ECM',   'Tle',  'C', 2), ('ECM',   'Tle',  'D', 2),
  ('LV1',   'Tle',  'A4', 3), ('LV1',   'Tle',  'C', 2), ('LV1',   'Tle',  'D', 2),
  ('LV2',   'Tle',  'A4', 2),
  ('MATH',  'Tle',  'A4', 2), ('MATH',  'Tle',  'C', 5), ('MATH',  'Tle',  'D', 3),
  ('PC',    'Tle',  'A4', 1), ('PC',    'Tle',  'C', 4), ('PC',    'Tle',  'D', 3),
  ('SVT',   'Tle',  'A4', 1), ('SVT',   'Tle',  'C', 2), ('SVT',   'Tle',  'D', 4),
  ('EPS',   'Tle',  'A4', 1), ('EPS',   'Tle',  'C', 1), ('EPS',   'Tle',  'D', 1)
) as v(code, niveau, serie, coefficient)
join cycle cy on cy.nom = 'LYCEE'
join matiere_officielle mo on mo."cycleId" = cy.id and mo.code = v.code
join niveau n on n."cycleId" = cy.id and n.nom = v.niveau
join serie s on s."cycleId" = cy.id and s.nom = v.serie;

-- ============================================================
-- Somme de contrôle
-- ============================================================
-- Le TOTAL GENERAL de chaque colonne est fourni par le ministère : c'est une
-- somme de contrôle, et on s'en sert comme telle. La migration échoue plutôt
-- que de semer un barème faux.
do $$
declare
  v_attendu record;
  v_somme numeric;
begin
  for v_attendu in select * from (values
    ('COLLEGE', '6ème', null,  9),
    ('COLLEGE', '5ème', null,  9),
    ('COLLEGE', '4ème', null, 18),
    ('COLLEGE', '3ème', null, 18),
    ('LYCEE',   '1ère', 'A4', 19),
    ('LYCEE',   '1ère', 'C',  20),
    ('LYCEE',   '1ère', 'D',  19),
    ('LYCEE',   'Tle',  'A4', 22),
    ('LYCEE',   'Tle',  'C',  22),
    ('LYCEE',   'Tle',  'D',  21)
  ) as t(cycle, niveau, serie, total)
  loop
    select coalesce(sum(co.coefficient), 0) into v_somme
    from coefficient_officiel co
    join niveau n on n.id = co."niveauId"
    join cycle cy on cy.id = n."cycleId"
    left join serie s on s.id = co."serieId"
    where cy.nom = v_attendu.cycle
      and n.nom = v_attendu.niveau
      and coalesce(s.nom, '') = coalesce(v_attendu.serie, '');

    if v_somme <> v_attendu.total then
      raise exception
        'Barème officiel incohérent — % % % : somme % attendue %',
        v_attendu.cycle, v_attendu.niveau, coalesce(v_attendu.serie, '(sans série)'),
        v_somme, v_attendu.total;
    end if;
  end loop;
end $$;
