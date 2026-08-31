-- Recentrage produit sur le secondaire : ScolarGest ne s'adresse plus qu'au
-- collège et au lycée. La maternelle et le primaire sortent du catalogue.
--
-- Retrait du catalogue, pas suppression des données. Trois raisons :
--   1. Les notes et les inscriptions sont sous invariant « pas de suppression
--      dure » ; un établissement qui a déjà ouvert des classes de primaire doit
--      continuer à éditer ses bulletins et ses reçus.
--   2. `cycle` et `niveau` sont référencés par `cycle_etablissement`, `classe`
--      et `programme_etablissement` : un delete se heurterait aux clés
--      étrangères, ou pire, cascaderait.
--   3. La décision est réversible — repasser `disponible` à true rouvre le
--      cycle sans rien reconstruire.
--
-- Ce que la colonne signifie exactement : « proposable à la configuration ».
-- Elle ne dit rien de ce qui est déjà activé. `listCyclesActifs()` ne la filtre
-- donc pas, sans quoi une école déjà en primaire perdrait ses classes de vue.

alter table cycle
  add column if not exists disponible boolean not null default true;

comment on column cycle.disponible is
  'Cycle proposable à la configuration d''un établissement. Un cycle retiré (false) reste pleinement fonctionnel là où il est déjà activé.';

update cycle set disponible = false where nom in ('MATERNELLE', 'PRIMAIRE');

-- Coupure du chaînage sortant des cycles retirés. La 6ème devient le niveau
-- d'entrée du cursus : sans cela, `CM2 -> 6ème` ferait remonter un élève depuis
-- un cursus que le produit ne couvre plus, et `Grande Section -> CP1`
-- entretiendrait une progression interne à un cycle fermé.
update niveau
set "niveauSuivantId" = null
where "cycleId" in (select id from cycle where disponible = false);
