# 05 — Domaine métier : Gestion des élèves & responsables légaux

## Élèves, parents/tuteurs, inscriptions et suivi administratif — Version 2.0

---

# 1. Objectif du domaine

Ce domaine représente la population scolaire de l'établissement.

Il doit permettre de gérer :

* l'identité des élèves ;
* les responsables légaux ;
* l'inscription annuelle ;
* l'affectation aux classes ;
* l'évolution de l'élève au fil des années scolaires ;
* l'historique administratif.

L'objectif est d'avoir une source unique et fiable concernant chaque élève.

---

# 2. Principes métier

## 2.1 Séparation entre élève et inscription

Un élève n'est pas une inscription.

* **Élève** = une personne (identité stable)
* **Inscription** = sa présence dans une école pendant une année scolaire

```text
Élève Jean Dupont
    ↓
Inscription 2025-2026 — CM2
    ↓
Inscription 2026-2027 — 6ème
```

Un élève existe pendant plusieurs années. Ses informations personnelles ne sont pas dupliquées chaque année.

---

# 3. Entité Élève

## Rôle

Représente un enfant inscrit ou ayant été inscrit dans l'établissement.

## Structure

```text
Eleve
-----
id
etablissement_id
matricule
nom
prenoms
sexe
date_naissance
lieu_naissance
nationalite
photo
statut
ancien_matricule    -- conservé lors d'un import Excel
created_at
updated_at
```

---

# 4. Matricule élève

Généré automatiquement par le système.

Format : `ELV-{annee_scolaire}-{sequence}`

Exemple : `ELV-2025-000154`

* L'année dans le préfixe est l'**année de début de l'année scolaire** (ex. `2025` pour 2025-2026)
* La séquence repart à zéro par établissement et par année scolaire

Lors d'un import Excel, l'ancien matricule de l'école peut être conservé dans `ancien_matricule`.

---

# 5. Statut élève

| Statut | Signification |
|---|---|
| `ACTIF` | Élève actuellement dans l'école |
| `INACTIF` | Cas temporaire |
| `ARCHIVE` | Ancien élève conservé pour historique |
| `TRANSFERE` | Parti vers un autre établissement |

---

# 6. Responsables légaux

## Rôle

Gérer les personnes responsables de l'élève (père, mère, tuteur, autre).

## Structure

```text
Responsable
-----------
id
etablissement_id
nom
prenoms
telephone
email
adresse
profession
type
```

## Types de responsable

```text
PERE | MERE | TUTEUR | AUTRE
```

---

# 7. Relation Élève — Responsable

Un élève peut avoir plusieurs responsables. Un responsable peut avoir plusieurs élèves.

```text
EleveResponsable
----------------
id
eleve_id
responsable_id
lien_parente
principal       -- booléen, contact prioritaire
```

Le responsable marqué `principal = true` est le contact prioritaire pour les informations administratives.

---

# 8. Inscription scolaire

## Rôle

Relie un élève à une année scolaire et une classe.

## Structure

```text
Inscription
-----------
id
etablissement_id
eleve_id
annee_scolaire_id
classe_id
date_inscription
statut
decision_fin_annee  -- ADMIS | REDOUBLANT | DEPART
```

---

# 9. Statut inscription

| Statut | Signification |
|---|---|
| `ACTIVE` | En cours |
| `TERMINEE` | Fin d'année normale |
| `ANNULEE` | Annulée |
| `ABANDON` | Départ en cours d'année |

---

# 10. Règle d'unicité

Un élève ne peut avoir qu'une inscription `ACTIVE` dans une même année scolaire.

---

# 11. Génération de la facture à l'inscription

À la validation de l'inscription d'un élève dans une classe, le système génère automatiquement la `FactureEleve` à partir des tarifs de la classe. Le Comptable peut ensuite ajuster les lignes (remises, cas particuliers) avant de valider définitivement la facture. Voir doc 08 (Finance) pour le détail.

---

# 12. Réinscription et passage automatique

À la clôture d'une année scolaire, le système propose de faire passer les élèves admis au niveau suivant.

```text
Fin d'année N
    ↓
Système génère les propositions (Admis → niveau suivant)
    ↓
Directeur / Secrétaire valide ou ajuste élève par élève
    ↓
Création des inscriptions de l'année N+1
```

Cas gérés :

* **Passage** : CM2 → 6ème (via `niveau_suivant_id`)
* **Redoublement** : même niveau, à la discrétion du Directeur
* **Départ** : aucune nouvelle inscription

---

# 13. Historique scolaire

L'inscription conserve : année, classe, niveau, statut, décision de fin d'année.

Cela permet : consulter le parcours, régénérer d'anciens bulletins, produire des statistiques.

---

# 14. Nouveaux inscrits (élèves venant d'une autre école)

```text
Création élève
    ↓
Création responsables
    ↓
Inscription année actuelle
    ↓
Affectation classe
    ↓
Génération automatique de la facture
```

---

# 15. Import Excel

L'import gère :

* élèves existants (mise à jour) ;
* nouveaux élèves ;
* responsables ;
* classes.

Processus :

```text
Excel
    ↓
Correspondance champs
    ↓
Validation (Zod)
    ↓
Import
    ↓
Rapport d'erreurs (ligne par ligne)
```

---

# 16. Sécurité

Un utilisateur ne voit que les élèves de son établissement — isolation garantie par le repository pattern.

---

# 17. Décisions MVP

| Sujet | Décision |
|---|---|
| Séparation élève/inscription | Oui |
| Responsable multiple | Oui |
| Responsable principal | Oui |
| Matricule automatique | Oui — par établissement et par année scolaire |
| Ancien matricule import | Oui |
| Historique scolaire | Oui |
| Passage automatique | Oui — proposé, validé manuellement |
| Facture auto à l'inscription | Oui — ajustable par le Comptable |
| Import Excel | Prévu |
| Compte parent | Non MVP |

---

# 18. Hors MVP

Reporté :

* portail parent ;
* paiement par parent en ligne ;
* notifications parents ;
* suivi comportemental détaillé ;
* dossier médical ;
* transport ;
* cantine.

---

# Résumé du domaine

```text
PERSONNE
    ↓
Eleve (identité stable)
    ↓
Inscription annuelle (+ FactureEleve auto-générée)
    ↓
Classe
```

Cette conception permet de suivre un élève pendant toute sa scolarité sans dupliquer ses informations chaque année.
