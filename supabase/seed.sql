-- ScoolAdmin — catalogues système Togo (cycles, niveaux, séries) + plans d'abonnement.
-- Run with: supabase db reset (auto-applies after migrations) or `psql -f supabase/seed.sql`.

insert into cycle (nom, ordre) values
  ('MATERNELLE', 1), ('PRIMAIRE', 2), ('COLLEGE', 3), ('LYCEE', 4)
on conflict (nom) do update set ordre = excluded.ordre;

with c as (select id, nom from cycle)
insert into niveau ("cycleId", nom, ordre)
select c.id, v.nom, v.ordre
from (values
  ('MATERNELLE', 'Petite Section', 1),
  ('MATERNELLE', 'Moyenne Section', 2),
  ('MATERNELLE', 'Grande Section', 3),
  ('PRIMAIRE', 'CP1', 1),
  ('PRIMAIRE', 'CP2', 2),
  ('PRIMAIRE', 'CE1', 3),
  ('PRIMAIRE', 'CE2', 4),
  ('PRIMAIRE', 'CM1', 5),
  ('PRIMAIRE', 'CM2', 6),
  ('COLLEGE', '6ème', 1),
  ('COLLEGE', '5ème', 2),
  ('COLLEGE', '4ème', 3),
  ('COLLEGE', '3ème', 4),
  ('LYCEE', '2nde', 1),
  ('LYCEE', '1ère', 2),
  ('LYCEE', 'Tle', 3)
) as v(cycle_nom, nom, ordre)
join c on c.nom = v.cycle_nom
on conflict ("cycleId", nom) do update set ordre = excluded.ordre;

-- Chaînage niveauSuivantId (cross-cycle: Grande Section -> CP1, CM2 -> 6ème, 3ème -> 2nde).
with pairs as (
  select n.id as current_id, next.id as next_id
  from (values
    ('Petite Section', 'Moyenne Section'),
    ('Moyenne Section', 'Grande Section'),
    ('Grande Section', 'CP1'),
    ('CP1', 'CP2'),
    ('CP2', 'CE1'),
    ('CE1', 'CE2'),
    ('CE2', 'CM1'),
    ('CM1', 'CM2'),
    ('CM2', '6ème'),
    ('6ème', '5ème'),
    ('5ème', '4ème'),
    ('4ème', '3ème'),
    ('3ème', '2nde'),
    ('2nde', '1ère'),
    ('1ère', 'Tle')
  ) as v(nom, next_nom)
  join niveau n on n.nom = v.nom
  join niveau next on next.nom = v.next_nom
)
update niveau set "niveauSuivantId" = pairs.next_id
from pairs
where niveau.id = pairs.current_id;

with lycee as (select id from cycle where nom = 'LYCEE')
insert into serie ("cycleId", nom)
select lycee.id, s
from lycee, unnest(array['A4', 'C', 'D', 'F4', 'G2', 'G3']) as s
on conflict ("cycleId", nom) do nothing;

insert into plan_abonnement (nom, duree, prix) values
  ('Mensuel', 'MOIS', 25000),
  ('Annuel', 'AN', 250000)
on conflict (nom) do update set duree = excluded.duree, prix = excluded.prix;
