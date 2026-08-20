-- Séries du lycée : le catalogue initial (0003) ne couvrait que A4, C, D, F4,
-- G2 et G3. Il manquait des séries du baccalauréat togolais, ce qui rendait
-- certaines classes impossibles à créer.
--
-- On complète avec l'ensemble standard. Une série non utilisée par un
-- établissement reste sans classe rattachée : elle ne coûte qu'une ligne de
-- catalogue, alors qu'une série absente bloque une création.
--
-- Idempotent : rejouable sans effet de bord (contrainte d'unicité
-- ("cycleId", nom)).

with lycee as (select id from cycle where nom = 'LYCEE')
insert into serie ("cycleId", nom)
select lycee.id, s
from lycee,
  unnest(array['A1', 'A2', 'A4', 'B', 'C', 'D', 'E', 'F1', 'F2', 'F3', 'F4', 'G1', 'G2', 'G3']) as s
on conflict ("cycleId", nom) do nothing;
