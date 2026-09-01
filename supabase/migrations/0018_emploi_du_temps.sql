-- Emploi du temps hebdomadaire, une grille par classe.
--
-- Choix structurant : **aucune heure d'horloge**. Les lignes de la grille sont
-- des rangs ordonnés (« première heure » … « huitième heure ») et les colonnes
-- des jours. Une école togolaise n'a pas de journée type universelle — 07h00
-- ici, 07h30 là, une pause à géométrie variable — et imposer une grille horaire
-- obligerait chaque établissement à décrire sa journée avant de pouvoir placer
-- le moindre cours. Le rang suffit à dire « ce cours vient avant celui-là »,
-- qui est la seule information dont l'affichage a besoin.
--
-- Conséquence heureuse : les deux conflits qui comptent deviennent des
-- contraintes d'unicité, pas des calculs de chevauchement. Pas de `btree_gist`,
-- pas d'`EXCLUDE USING gist`, et surtout aucun risque de saisie concurrente qui
-- passerait entre deux vérifications applicatives.
--
--   1. Une classe ne peut pas avoir deux cours sur la même case.
--   2. Un enseignant ne peut pas être dans deux classes sur la même case.
--
-- La seconde est un index unique **partiel** : le créneau peut n'avoir aucun
-- enseignant affecté (matière placée avant de savoir qui l'assure), et NULL ne
-- doit pas entrer en conflit avec NULL.
--
-- Suppression franche assumée : un créneau n'est ni une note, ni une facture,
-- ni une inscription. L'invariant « pas de suppression dure » protège les
-- données financières et académiques historisées ; un emploi du temps est un
-- réglage courant, réécrit plusieurs fois par trimestre. L'`audit_log` garde la
-- trace de qui a retiré quoi.

create table emploi_du_temps_creneau (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  "anneeScolaireId" uuid not null references annee_scolaire(id),
  "classeId" uuid not null references classe(id),
  -- 1 = lundi … 6 = samedi. Le dimanche n'est pas représentable, volontairement.
  jour smallint not null check (jour between 1 and 6),
  -- Rang dans la journée, 1 = première heure … 8 = huitième heure.
  rang smallint not null check (rang between 1 and 8),
  "matiereId" uuid not null references matiere(id),
  -- Facultatif : on place souvent la matière avant de connaître l'enseignant.
  "enseignantId" uuid references enseignant(id),
  salle text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

-- Une seule matière par case pour une classe donnée.
create unique index emploi_du_temps_case_unique
  on emploi_du_temps_creneau ("classeId", "anneeScolaireId", jour, rang);

-- Un enseignant ne peut pas être à deux endroits à la fois. Partiel : un
-- créneau sans enseignant n'entre en conflit avec rien.
create unique index emploi_du_temps_enseignant_unique
  on emploi_du_temps_creneau ("enseignantId", "anneeScolaireId", jour, rang)
  where "enseignantId" is not null;

-- Lecture d'une grille complète : le chemin emprunté par tous les écrans.
create index emploi_du_temps_classe_idx
  on emploi_du_temps_creneau ("etablissementId", "anneeScolaireId", "classeId");

-- « Mon emploi du temps » côté enseignant.
create index emploi_du_temps_enseignant_idx
  on emploi_du_temps_creneau ("etablissementId", "anneeScolaireId", "enseignantId");

create trigger trg_emploi_du_temps_updated before update on emploi_du_temps_creneau
  for each row execute function touch_updated_at();

alter table emploi_du_temps_creneau enable row level security;
create policy emploi_du_temps_tenant on emploi_du_temps_creneau for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());
