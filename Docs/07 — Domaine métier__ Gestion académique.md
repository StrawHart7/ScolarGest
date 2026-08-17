# 07 — Domaine métier : Gestion académique

## Matières, programmes, évaluations, notes, coefficients & calculs des moyennes — Version 2.0

---

# 1. Objectif du domaine

Ce domaine représente toute la partie pédagogique liée aux résultats scolaires.

Il gère :

* les matières enseignées ;
* la structure académique par niveau (ProgrammeEtablissement) ;
* les coefficients (historisés par année scolaire) ;
* les types d'évaluations ;
* la saisie des notes et leur cycle de validation ;
* le calcul automatique des moyennes ;
* les résultats nécessaires aux bulletins.

C'est l'un des domaines les plus sensibles — les calculs doivent être parfaitement fiables.

---

# 2. Principes métier

## 2.1 Les matières sont personnalisables par établissement

Chaque établissement peut adapter son catalogue de matières. La plateforme propose une base standard que l'établissement peut activer, désactiver ou compléter.

## 2.2 Barème unique — /20

Tous les niveaux (maternelle, primaire, collège, lycée) utilisent le même barème /20 avec classement. Le livret de compétences maternelle/primaire est reporté à une version ultérieure.

---

# 3. Entité Matière

```text
Matiere
--------
id
etablissement_id
nom
code
description
statut
created_at
updated_at
```

---

# 4. ProgrammeEtablissement — matière par niveau

Une matière n'est pas forcément enseignée à tous les niveaux. `ProgrammeEtablissement` relie une matière à un niveau dans un établissement.

```text
ProgrammeEtablissement
-----------------------
id
etablissement_id
niveau_id
matiere_id
obligatoire         -- booléen
ordre_affichage
```

---

# 5. Matière obligatoire ou facultative

Une matière peut être obligatoire ou facultative.

**Règle de calcul pour les matières facultatives** : si l'élève a une note, elle est incluse dans la moyenne générale avec son coefficient normal. Si l'élève n'a aucune note saisie pour cette matière, elle est simplement ignorée (ni bonus ni malus).

---

# 6. Coefficients — historisés par année scolaire

Le coefficient dépend du niveau et de la série au lycée.

```text
CoefficientMatiere
------------------
id
programme_etablissement_id
annee_scolaire_id           -- historisation obligatoire dès v1
serie_id                    -- NULL pour primaire/collège (sans série)
coefficient
```

**Historisation obligatoire** : chaque coefficient est lié à une `annee_scolaire_id`. Modifier un coefficient pour l'année courante ne crée pas une nouvelle entrée — cela modifie l'entrée de l'année en cours. Créer un coefficient pour une nouvelle année crée une nouvelle entrée. Les bulletins des années passées pointent toujours vers les coefficients de leur propre année scolaire, garantissant leur intégrité.

**Règle de nommage** : l'entité s'appelle exclusivement `ProgrammeEtablissement` (pas `ProgrammeNiveau`).

Exemples :

```text
Mathématiques — Terminale — Série D — 2025-2026 : coefficient 4
Mathématiques — Terminale — Série A4 — 2025-2026 : coefficient 2
Mathématiques — 6ème — (sans série) — 2025-2026 : coefficient 3
```

---

# 7. Types d'évaluation

Trois types supportés en MVP :

| Type | Description |
|---|---|
| `INTERROGATION` | Maximum 3 par période, moyenne calculée |
| `DEVOIR` | Une seule note par période |
| `COMPOSITION` | Une seule note par période |

---

# 8. Entité Évaluation

```text
Evaluation
----------
id
annee_scolaire_id
classe_id
matiere_id
type                -- INTERROGATION | DEVOIR | COMPOSITION
periode             -- TRIMESTRE_1 | TRIMESTRE_2 | TRIMESTRE_3
numero              -- numéro d'interro (1, 2 ou 3)
date
```

Contrainte d'unicité : `(classe_id, matiere_id, type, periode, numero)`.

---

# 9. Entité Note

```text
Note
----
id
evaluation_id
eleve_id
valeur              -- sur 20
observation
statut              -- BROUILLON | SOUMISE | EN_ATTENTE | VALIDE | REJETE
```

## Cycle de vie d'une note

```text
BROUILLON   → Enseignant en cours de saisie, modifications libres
SOUMISE     → Enseignant a validé, note prise en compte dans les calculs
EN_ATTENTE  → Enseignant demande une modification post-soumission → workflow
VALIDE      → Secrétaire a approuvé la modification (avec PIN)
REJETE      → Secrétaire a rejeté la demande
```

Tant qu'une note est en `BROUILLON`, l'enseignant peut la modifier librement. Une fois `SOUMISE`, toute modification déclenche le workflow d'approbation (Secrétaire + PIN).

---

# 10. Calcul des moyennes

## Étape 1 — Moyenne des interrogations

```
Somme des interrogations / Nombre d'interrogations saisies
```

Si aucune interro n'est saisie, on calcule sans. Si une seule est saisie, on divise par 1.

Exemple : (12 + 15 + 18) / 3 = 15

## Étape 2 — Moyenne de classe (par période)

```
(Moyenne interrogations + Devoir) / 2
```

Si une composante manque (pas d'interro ou pas de devoir), on calcule avec ce qui existe (devoir seul = moyenne de la période).

Exemple : (15 + 14) / 2 = 14.5

## Étape 3 — Moyenne matière finale (trimestrielle)

```
(Moyenne classe + Composition) / 2
```

Exemple : (14.5 + 16) / 2 = 15.25

## Étape 4 — Moyenne trimestrielle générale

```
Somme(moyenne matière × coefficient) / Somme(coefficients)
```

Les matières facultatives sans note sont exclues du calcul (numérateur et dénominateur).

## Étape 5 — Moyenne annuelle

```
(Moyenne T1 + Moyenne T2 + Moyenne T3) / 3
```

## Arrondi

Affichage à deux décimales : 14.666... → 14.67

---

# 11. Appréciations automatiques

| Tranche | Appréciation |
|---|---|
| 18 ≤ note ≤ 20 | Excellent |
| 16 ≤ note < 18 | Très Bien |
| 14 ≤ note < 16 | Bien |
| 12 ≤ note < 14 | Assez Bien |
| 10 ≤ note < 12 | Passable |
| 8 ≤ note < 10 | Insuffisant |
| 6 ≤ note < 8 | Très Insuffisant |
| 4 ≤ note < 6 | Très Mal |
| 0 ≤ note < 4 | Médiocre |

---

# 12. Classement

Le système calcule pour chaque période (et pour l'annuel) :

* rang de chaque élève dans sa classe (sur la moyenne générale) ;
* meilleure moyenne de la classe ;
* plus faible moyenne de la classe ;
* moyenne générale de la classe.

Le classement se fait **par moyenne générale** et également **par matière** (affiché sur le bulletin).

---

# 13. Bulletin

Généré automatiquement en PDF (Playwright server-side) à partir des données calculées.

Contenu :

* informations établissement (nom, logo, adresse) ;
* informations scolaires (année, trimestre, classe, effectif) ;
* informations élève (nom, prénom, sexe) ;
* tableau des résultats par matière (moyenne classe, composition, moyenne générale, coefficient, note définitive, rang matière, appréciation, enseignant) ;
* synthèse (moyenne trimestre, rang général, statistiques classe) ;
* zone de signature physique (pas de signature numérique en v1).

La génération d'un bulletin est libre pour la Secrétaire. Le Directeur voit passer les bulletins dans son flux d'activité mais n'a pas à approuver.

---

# 14. Workflow d'approbation des notes

Voir doc 03 (Identité) pour le détail complet. Résumé :

* L'Enseignant ne peut modifier librement une note que si elle est en `BROUILLON`
* Toute modification d'une note `SOUMISE` déclenche le workflow (statut `EN_ATTENTE`)
* La Secrétaire voit la file d'attente, saisit son PIN, et valide/rejette/propose

---

# 15. Décisions MVP

| Sujet | Décision |
|---|---|
| Matières personnalisables | Oui |
| Catalogue standard | Oui |
| Nom de l'entité programme | `ProgrammeEtablissement` (unique) |
| Coefficients historisés | Oui — par `annee_scolaire_id` dès v1 |
| Barème | /20 pour tous les niveaux |
| Interrogations max | 3 par période |
| Composante manquante | On calcule avec ce qui existe |
| Matières facultatives | Incluses si note présente, ignorées sinon |
| Appréciations | 9 tranches de 0 à 20 |
| Classement | Par moyenne générale et par matière |
| Workflow modification note | Oui — Secrétaire + PIN |
| Signature numérique | Non |
| Livret compétences maternelle | Non MVP |

---

# 16. Hors MVP

Reporté :

* livret de compétences (maternelle/primaire) ;
* appréciations libres avancées ;
* correction en ligne ;
* espace professeur complet ;
* absences intégrées aux bulletins ;
* statistiques pédagogiques avancées.

---

# Résumé du domaine

```text
Classe + Matière + Année scolaire + Enseignant
    ↓
AffectationEnseignant (droits de saisie)
    ↓
Evaluation (INTERROGATION | DEVOIR | COMPOSITION)
    ↓
Note (cycle BROUILLON → SOUMISE → EN_ATTENTE → VALIDE)
    ↓
Calcul automatique (moyennes + classements)
    ↓
Bulletin PDF
```

Ce domaine constitue le moteur pédagogique du logiciel.
