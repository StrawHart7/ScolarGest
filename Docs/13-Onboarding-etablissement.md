# Checklist d'onboarding d'un établissement

Séquence à suivre pour ouvrir une école sur ScolarGest. L'ordre n'est pas
indicatif : chaque étape dépend de la précédente, et sauter une étape produit un
écran vide plus loin sans expliquer pourquoi.

Le rôle indiqué est celui qui exécute l'étape. « Nous » désigne l'équipe
ScolarGest, « l'école » son personnel.

---

## Phase 1 — Ouverture du compte (nous)

| # | Rôle | Écran | Action |
|---|---|---|---|
| 1.1 | SUPER_ADMIN | `/super-admin/etablissements/nouveau` | Créer l'établissement : nom, sigle, ville, téléphone, e-mail. |
| 1.2 | SUPER_ADMIN | `/super-admin/abonnements/nouveau` | Rattacher un plan et fixer les dates de début et de fin. |
| 1.3 | SUPER_ADMIN | `/utilisateurs/inviter` | Inviter le **Directeur**. Il reçoit un e-mail et choisit son mot de passe. |

> Sans l'étape 1.2, l'école se retrouve en accès bloqué dès la première
> connexion et sera renvoyée vers `/abonnement` sans pouvoir rien faire.
>
> L'étape 1.3 envoie un vrai e-mail. Vérifier l'adresse avant de valider :
> une invitation partie à la mauvaise adresse ne se rappelle pas.

## Phase 2 — Structure scolaire (Directeur)

| # | Écran | Action |
|---|---|---|
| 2.1 | `/etablissement/cycles` | Activer les cycles enseignés (Maternelle, Primaire, Collège, Lycée). Tout le reste en dépend. |
| 2.2 | `/etablissement/annees-scolaires` | Créer l'année, puis **l'activer**. Une seule année active à la fois. |
| 2.3 | `/etablissement/classes` | Créer les classes : niveau, série pour le lycée, nom, capacité. |
| 2.4 | `/etablissement/matieres` | Saisir les matières enseignées. |
| 2.5 | `/etablissement/programme` | Rattacher les matières à chaque niveau, en distinguant obligatoires et optionnelles. |
| 2.6 | `/etablissement/programme/coefficients` | Fixer les coefficients, **par série** au lycée. |

> Les coefficients sont rattachés à l'année : les modifier l'an prochain ne
> touchera pas les bulletins déjà édités. C'est voulu, et c'est ce qui permet de
> rééditer un bulletin ancien à l'identique des années plus tard.

## Phase 3 — Comptes du personnel (Directeur)

| # | Écran | Action |
|---|---|---|
| 3.1 | `/utilisateurs/inviter` | Inviter la Secrétaire, le Comptable et les Enseignants. |
| 3.2 | `/profil/parametres` | **Chaque** utilisateur définit son PIN de confirmation. |

> Sans PIN, les actions irréversibles (approbation d'une correction de note,
> clôture d'année) sont impossibles pour la personne concernée — et le message
> d'erreur n'apparaît qu'au moment où elle en a besoin, souvent le pire moment.
> Faire définir les PIN dès l'ouverture, pas au premier blocage.

## Phase 4 — Reprise des données (Secrétaire)

| # | Écran | Action |
|---|---|---|
| 4.1 | `/etablissement/eleves/import` | Importer les élèves depuis Excel. Contrôler le rapport d'erreurs **avant** de valider. |
| 4.2 | `/etablissement/enseignants/import` | Importer les enseignants. |
| 4.3 | `/etablissement/eleves/[id]/inscription` | Inscrire chaque élève dans sa classe pour l'année active. |
| 4.4 | `/etablissement/enseignants/[id]/affectations` | Affecter chaque enseignant à ses classes et matières. |
| 4.5 | `/etablissement/classes/[id]/affectations` | Vérifier la couverture : toute matière du programme doit avoir un enseignant. |

> Un élève créé mais **non inscrit** n'apparaît sur aucun bulletin, aucune
> facture et aucune liste de classe. C'est l'oubli le plus fréquent de la
> reprise, et il ne se voit qu'au moment d'éditer les documents.

## Phase 5 — Paramétrage financier (Comptable)

| # | Écran | Action |
|---|---|---|
| 5.1 | `/etablissement/finances/types-frais` | Définir les types de frais (inscription, scolarité, cantine, transport…). |
| 5.2 | `/etablissement/finances/tarifs` | Fixer les montants, par classe et par type, pour l'année active. |
| 5.3 | `/etablissement/finances/factures` | Générer les factures des élèves inscrits. |
| 5.4 | `/etablissement/finances/import` | Facultatif : importer les versements déjà encaissés avant la bascule. |

> Les tarifs sont eux aussi rattachés à l'année : une hausse l'an prochain ne
> modifiera aucune facture déjà émise.

## Phase 6 — Vérification avant remise (nous, avec le Directeur)

À faire écran par écran, connecté avec un compte de chaque rôle. Un point qui
échoue ici coûte une heure ; le même point découvert par l'école en pleine
rentrée coûte sa confiance.

- [ ] `/dashboard` affiche des effectifs cohérents pour chacun des quatre rôles.
- [ ] `/etablissement/classes` : chaque classe a son effectif réel.
- [ ] `/etablissement/notes/saisie` : un enseignant voit **ses** classes, et
      uniquement les siennes.
- [ ] `/etablissement/finances/factures` : les soldes correspondent aux tarifs.
- [ ] Éditer un bulletin de test et un reçu de test, puis les ouvrir en PDF.
- [ ] `/rapports` : un export Excel se télécharge et s'ouvre.
- [ ] `/abonnement` affiche le bon plan et la bonne échéance.

## Phase 7 — Remise

- [ ] Former le Directeur et la Secrétaire sur les parcours quotidiens.
- [ ] Remettre les identifiants et rappeler la politique de mot de passe.
- [ ] Fixer le contact de support et le délai de réponse annoncé.
- [ ] Consigner la date d'ouverture et la personne référente côté école.

---

## Durée constatée

À renseigner après le premier onboarding réel, école par école. Sans mesure,
toute estimation commerciale du coût d'ouverture d'un compte est une supposition.

| École | Date | Durée phases 1-5 | Durée phase 6 | Remarques |
|---|---|---|---|---|
| _(à compléter)_ | | | | |
