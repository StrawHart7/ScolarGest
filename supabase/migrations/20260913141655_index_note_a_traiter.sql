-- Les notes à traiter : un index partiel, et pourquoi il manquait
-- ============================================================
-- Constaté en production le 2026-09-13, par les logs et non par le code : le
-- tableau de bord et la page des années scolaires tombaient par intermittence,
-- et un rechargement suffisait à les faire passer.
--
-- La cause est un `statement timeout` sur le décompte des notes en attente.
-- `EXPLAIN` sur la requête nue, **sans RLS** :
--
--     Seq Scan on note  (actual time=281.687..281.687 rows=0)
--       Filter: (statut = 'EN_ATTENTE')
--       Rows Removed by Filter: 28131
--     Execution Time: 283.092 ms
--
-- 283 ms pour rendre **zéro ligne**, parce que `note.statut` n'a aucun index :
-- les trois index de la table portent sur `id`, `eleveId` et
-- `(evaluationId, eleveId)`.
--
-- ## Pourquoi ça dépasse le délai alors que 283 ms n'est pas long
--
-- La RLS. La policy `note_lecture` ajoute, **par ligne**, un
-- `EXISTS (select 1 from evaluation join classe ...)`. Sur un parcours complet
-- de 28 131 lignes, ce sont 28 131 évaluations d'un sous-plan corrélé au lieu
-- d'une poignée. Le chiffre de 283 ms est donc un plancher, pas le coût réel.
--
-- Leçon à garder : **une politique RLS transforme un parcours séquentiel
-- tolérable en requête qui expire.** Un index absent ne coûte pas la même chose
-- ici que dans une base sans RLS, et c'est précisément sur les tables les plus
-- protégées — notes, paiements — que la table est la plus grosse.
--
-- ## Pourquoi partiel
--
-- Les statuts réellement présents sont `VALIDE` (27 793) et `BROUILLON` (338).
-- `SOUMISE` et `EN_ATTENTE` — les deux qui intéressent ces écrans — n'existent
-- à aucune ligne aujourd'hui, et resteront toujours une minorité : ce sont des
-- états de passage dans un circuit de validation, pas un état de repos.
--
-- Un index complet sur `statut` indexerait 28 000 lignes pour en servir
-- quelques-unes, et se réécrirait à chaque validation de note. L'index partiel
-- ne contient que la file d'attente, reste quasi vide, et coûte presque rien à
-- maintenir.
--
-- La condition couvre les **deux** statuts parce que les deux écrans ne
-- demandent pas la même chose : la page des années scolaires compte les
-- `EN_ATTENTE`, le tableau de bord compte `SOUMISE` **et** `EN_ATTENTE`.
-- Postgres sait employer un index partiel dès que le prédicat de la requête
-- implique celui de l'index — `statut = 'EN_ATTENTE'` implique bien
-- `statut in ('SOUMISE','EN_ATTENTE')`.
--
-- `evaluationId` en colonne indexée : les deux requêtes joignent ou filtrent
-- ensuite sur l'évaluation, pour remonter à l'année ou à la classe.
--
-- ## Pas de `concurrently`
--
-- Sur 28 000 lignes la construction prend quelques dizaines de millisecondes,
-- et `create index concurrently` interdirait le bloc transactionnel dans lequel
-- cette migration s'applique. Le compromis s'inverserait sur une table de
-- plusieurs millions de lignes ; il faudra y repenser, pas le recopier.

create index if not exists idx_note_a_traiter
  on public.note ("evaluationId")
  where statut in ('SOUMISE', 'EN_ATTENTE');

comment on index public.idx_note_a_traiter is
  'File de validation des notes. Partiel : les deux statuts de passage sont une minorite structurelle, et un index complet sur statut se reecrirait a chaque validation.';


-- ============================================================
-- On vérifie que le plan a changé
-- ============================================================
-- Une migration d'index qui ne constate rien se contente d'espérer. Le bloc
-- ci-dessous demande le plan à Postgres et échoue si le parcours séquentiel est
-- toujours là — c'est la seule chose qui distingue « index créé » de « index
-- utilisé ».
do $do$
declare
  v_plan text := '';
  v_ligne text;
begin
  for v_ligne in
    execute 'explain select count(*) from note n
               join evaluation e on e.id = n."evaluationId"
              where n.statut = ''EN_ATTENTE'''
  loop
    v_plan := v_plan || v_ligne || E'\n';
  end loop;

  if v_plan like '%Seq Scan on note%' then
    raise exception
      'L''index n''est pas employe : le plan parcourt toujours `note` en entier. Plan : %',
      v_plan;
  end if;

  raise notice 'Index employe. Plan : %', v_plan;
end;
$do$;
