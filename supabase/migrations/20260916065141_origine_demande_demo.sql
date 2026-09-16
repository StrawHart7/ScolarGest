-- D'ou vient une demande de demo
--
-- Le formulaire public est le seul appel a l'action du site, et trois chemins
-- tres differents y menent : le bandeau d'accueil, le bouton de la barre de
-- navigation, et les trois offres de la grille tarifaire. Les trois arrivaient
-- identiques dans la file du SUPER_ADMIN.
--
-- On ne savait donc pas si l'on rappelait une ecole qui decouvre le produit ou
-- une ecole qui vient de cliquer « Rejoindre le programme » sur l'offre
-- fondatrice — c'est-a-dire la conversation la plus avancee que le site sache
-- produire, et celle dont les places sont comptees.
--
-- `DIRECT` par defaut, et la colonne est NOT NULL : une demande sans origine
-- connue est une demande directe, pas une donnee manquante. Le defaut vaut
-- aussi pour les lignes deja en base, qui ont bien ete envoyees depuis un
-- bouton general — c'etait le seul chemin instrumente.
--
-- **L'origine est declaree par le navigateur du visiteur** et l'insertion de
-- `demande_demo` est publique : c'est une indication commerciale, jamais une
-- preuve. Aucune decision automatique n'en decoule — l'admission au programme
-- fondateur reste un geste manuel du SUPER_ADMIN. L'enum sert a borner les
-- valeurs, pas a authentifier le visiteur.
--
-- Un enum plutot qu'un texte libre : la file est lue par un ecran qui met une
-- etiquette par valeur, et un texte libre y ferait apparaitre un jour une
-- valeur sans libelle. Ajouter une offre demandera un `alter type` — c'est le
-- prix, et il est modeste au regard du nombre d'offres.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'origine_demande') then
    create type origine_demande as enum (
      'DIRECT',
      'OFFRE_1_CYCLE',
      'OFFRE_2_CYCLES',
      'PROGRAMME_FONDATEUR'
    );
  end if;
end $$;

alter table demande_demo
  add column if not exists origine origine_demande not null default 'DIRECT';

comment on column demande_demo.origine is
  'Offre depuis laquelle le visiteur a ouvert le formulaire. Declaree par son navigateur (parametre d''URL) : indication commerciale, jamais une preuve.';
