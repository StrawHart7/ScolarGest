-- Repose le `NOT NULL` sur `abonnement_etablissement.montantTotal`.
--
-- ============================================================
-- Pourquoi cette migration existe séparément de 0026
-- ============================================================
-- `0026` posait déjà cette contrainte. Elle a dû être retirée à la main, en
-- urgence, quelques heures plus tard : la production tournait encore sur
-- `main`, dont le `createAbonnement` n'écrivait ni `nombreCycles` ni
-- `montantTotal`. Toute création manuelle d'abonnement depuis la console
-- plateforme échouait donc en `23502`, et l'écran n'affichait que « Erreur
-- lors de la création » — le message Postgres n'étant pas remonté.
--
-- **Une contrainte suit le code, elle ne le précède pas.** La base est
-- partagée par tous les déploiements ; une branche ne l'est pas. Resserrer un
-- schéma depuis une branche non fusionnée revient à imposer à la production
-- une règle que seule la branche sait respecter. C'est le mode de panne à
-- retenir : il ne se voit ni au build, ni aux tests, ni en local — seulement
-- sur l'environnement qui porte l'ancien code.
--
-- La contrainte est donc reposée ici, après la fusion de
-- `feat/soko-abonnements`, dont `ouvrirPeriode` exige le montant et le nombre
-- de cycles et refuse leur absence avant même d'atteindre la base.
--
-- ============================================================
-- Ce que la colonne garantit
-- ============================================================
-- Le revenu de la console plateforme se lit sur `montantTotal`, figé à la
-- souscription. Un NULL n'y est pas une donnée manquante : c'est un chiffre
-- d'affaires faux, et personne ne le verrait. Trois lignes en portaient un
-- avant `0026` — deux à zéro et une à 250 000 F qui ne correspondait à aucune
-- ligne du catalogue.
--
-- Zéro reste une valeur légitime : une période offerte, ou une activation
-- autorisée par la plateforme tant que le paiement en ligne n'est pas ouvert.
-- C'est bien le montant payé, et le revenu constaté doit le refléter.

-- Filet de sécurité : une ligne créée entre le retrait et le rétablissement de
-- la contrainte porterait un NULL et ferait échouer l'ALTER. On la répare
-- depuis le catalogue plutôt que de laisser la migration tomber — la valeur
-- ainsi reconstituée est celle du plan, ce qui est exactement ce que l'ancien
-- formulaire aurait facturé.
update abonnement_etablissement a
set "montantTotal" = round(p.prix * a."nombreCycles", 2)
from plan_abonnement p
where a."planId" = p.id
  and a."montantTotal" is null;

alter table abonnement_etablissement
  alter column "montantTotal" set not null;

comment on column abonnement_etablissement."montantTotal" is
  'Montant réellement facturé (prix du plan x nombreCycles), historisé et NOT NULL depuis 0027. Zéro est licite (période offerte, activation autorisée par la plateforme). Ne jamais le recalculer depuis le catalogue : le prix peut avoir changé depuis.';
