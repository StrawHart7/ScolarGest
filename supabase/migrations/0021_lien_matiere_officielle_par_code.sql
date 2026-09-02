-- Retrait de `matiere.matiereOfficielleId`, introduite par erreur en `0020`.
--
-- **Le lien ne pouvait pas tenir.** `matiere` porte un `etablissementId` et
-- rien d'autre : une école a **une** matière « Français ». `matiere_officielle`
-- porte un `cycleId`, parce que le programme national distingue le collège du
-- lycée — « Physique-Chimie-Technologie » d'un côté, « Physique-Chimie » de
-- l'autre. Une école qui enseigne les deux cycles aurait donc dû faire pointer
-- son unique « Français » vers deux matières officielles à la fois.
--
-- La colonne est retirée plutôt que laissée inerte : `etablissement.logo`
-- traîne depuis `0001` sans usage et il a fallu l'écrire dans CLAUDE.md pour
-- que personne ne s'en serve. Une colonne morte finit toujours par être lue.
--
-- **Le rattachement se fait désormais par le code**, résolu au moment où l'on
-- applique le barème. La ligne de programme porte un `niveauId`, donc un
-- cycle : `(cycle du niveau, matiere.code)` désigne sans ambiguïté la matière
-- officielle. Un code qui ne correspond à rien — « INFO », une matière maison —
-- signifie simplement qu'il n'y a pas de barème national, et l'école saisit son
-- coefficient comme avant.

drop index if exists matiere_officielle_unique_par_etablissement;
alter table matiere drop column if exists "matiereOfficielleId";

-- Le code devient la clé de rattachement : il doit être unique dans une école.
-- Sans cela, deux matières partageant « FRA » recevraient toutes deux le
-- coefficient national du français, en silence.
--
-- Index partiel : `code` est facultatif, et plusieurs matières sans code ne
-- sont pas en conflit.
create unique index matiere_code_unique_par_etablissement
  on matiere ("etablissementId", code)
  where code is not null;
