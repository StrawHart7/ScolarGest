-- Séries du lycée : le catalogue initial (0003) ne couvrait que A4, C, D, F4,
-- G2 et G3. Il manquait des séries du baccalauréat togolais, ce qui rendait
-- certaines classes impossibles à créer.
--
-- Liste arrêtée avec l'établissement : A1, A2 et B ne sont pas proposées et
-- sont volontairement absentes.
--
-- Idempotent : rejouable sans effet de bord (contrainte d'unicité
-- ("cycleId", nom)). Note : cette migration n'enlève rien — retirer une série
-- déjà rattachée à des classes casserait l'historique.

with lycee as (select id from cycle where nom = 'LYCEE')
insert into serie ("cycleId", nom)
select lycee.id, s
from lycee,
  unnest(array['A4', 'C', 'D', 'E', 'F1', 'F2', 'F3', 'F4', 'G1', 'G2', 'G3']) as s
on conflict ("cycleId", nom) do nothing;
