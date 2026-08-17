# 04 — Domaine métier : Structure scolaire

## Établissement, cycles, niveaux, classes, années scolaires & séries — Version 2.0

---

# 1. Objectif du domaine

Ce domaine représente l'organisation académique fondamentale d'un établissement.

Il définit :

* ce qu'est une école dans le système ;
* les cycles qu'elle propose ;
* les niveaux existants ;
* les classes ouvertes chaque année ;
* les séries du lycée ;
* la structure dans laquelle les élèves et enseignants évoluent.

C'est le squelette de toute l'application.

---

# 2. Principes métier

## 2.1 Un établissement = un écosystème fermé

Chaque établissement possède son propre environnement. Une école contient ses élèves, ses enseignants, ses classes, ses matières, ses paiements, ses résultats. Aucune relation métier directe entre établissements.

## 2.2 Un établissement peut être complet ou partiel

Le système supporte les établissements complets (Maternelle → Lycée) et les établissements partiels (ex. Collège uniquement). Priorité opérationnelle v1 : le collège.

---

# 3. Entité Établissement

## Rôle

Représente l'école cliente utilisant le SaaS.

## Structure

```text
Etablissement
--------------
id
nom
sigle
logo
adresse
ville
telephone
email
type
statut
created_at
updated_at
```

---

# 4. Entité Cycle

Catalogue système fixe. Non personnalisable par établissement.

```text
Cycle
-----
id
nom
ordre
```

Valeurs standards :

```text
MATERNELLE
PRIMAIRE
COLLEGE
LYCEE
```

---

# 5. Activation des cycles par établissement

Une école choisit les cycles qu'elle possède.

```text
CycleEtablissement
------------------
id
etablissement_id
cycle_id
actif
```

---

# 6. Niveaux scolaires

Les niveaux sont fixes — non personnalisables par établissement. Le système scolaire togolais a une structure suffisamment standard.

```text
Niveau
------
id
cycle_id
nom
ordre
niveau_suivant_id   -- référence vers le prochain niveau (séquence ordonnée)
```

Le champ `niveau_suivant_id` modélise la progression ordonnée traversant les cycles (ex. CM2 → 6ème). Le cas terminal (Terminale → sortie) a `niveau_suivant_id = NULL`.

## Niveaux par cycle

**Maternelle** : Petite Section, Moyenne Section, Grande Section

**Primaire** : CP1, CP2, CE1, CE2, CM1, CM2

**Collège** : 6ème, 5ème, 4ème, 3ème

**Lycée** : Seconde, Première, Terminale

---

# 7. Séries lycée

Entité :

```text
Serie
-----
id
nom
cycle_id
```

Exemples de valeurs : A4, C, D, F4, G2, G3.

Une série concerne principalement le lycée. Une classe de lycée = Niveau + Série.

---

# 8. Relation Niveau / Série

```text
Classe = Niveau + Série (optionnelle)
```

Exemple :

* Terminale D1 (Niveau = Terminale, Série = D)
* 6ème A (Niveau = 6ème, pas de série)

---

# 9. Année scolaire

## Rôle

Permet de séparer les périodes académiques. Toute donnée scolaire appartient à une année scolaire.

## Structure

```text
AnneeScolaire
-------------
id
etablissement_id
libelle             -- ex. "2025-2026"
date_debut
date_fin
statut
```

## Statuts

```text
PREPARATION
ACTIVE
TERMINEE
```

**Règle** : une seule `AnneeScolaire` avec statut `ACTIVE` par établissement à la fois.

## Clôture d'une année

Quand une année passe en `TERMINEE` :
* Les opérations courantes passent à la nouvelle année `ACTIVE`
* Le Directeur et la Secrétaire conservent leurs droits de modification sur l'année `TERMINEE` (via le workflow d'approbation habituel pour les notes)

---

# 10. Classes

## Rôle

Une classe représente un groupe d'élèves pendant une année scolaire.

## Structure

```text
Classe
------
id
etablissement_id
annee_scolaire_id
niveau_id
serie_id            -- NULL si pas de série (primaire, collège)
nom                 -- ex. "6ème A", "Terminale D1"
capacite
```

Une classe dépend de l'année scolaire car elle n'existe pas éternellement. La 6ème A de 2025-2026 et la 5ème A de 2026-2027 sont deux objets distincts.

## Classes multiples d'un même niveau

Supporté : 6ème A, 6ème B, 6ème C — toutes au même niveau.

---

# 11. Tarifs par classe

Les tarifs scolaires sont définis **par classe** (pas par niveau). Ils sont saisis lors de la création de chaque classe. Voir doc 08 (Finance) pour le détail.

---

# 12. Passage automatique des élèves

À la clôture d'une année scolaire, le système propose le passage automatique des élèves admis vers le niveau suivant.

```text
Élève admis en 6ème A (2025-2026)
    ↓
Système propose inscription en 5ème (2026-2027)
    ↓
Directeur / Secrétaire valide ou ajuste élève par élève
```

Cas gérés : passage, redoublement (même niveau), départ (aucune nouvelle inscription).

Règle sur le redoublement : à la discrétion du Directeur, pas de limite fixe.

---

# 13. Paramétrage initial par notre équipe

Lors de la création d'un établissement, notre équipe (SUPER_ADMIN) configure :

* cycles disponibles ;
* première année scolaire ;
* structure initiale.

L'établissement peut ensuite créer ses classes, ouvrir de nouvelles classes et modifier certains paramètres autorisés.

---

# 14. Contraintes métier

* Une classe doit obligatoirement avoir : un établissement, une année scolaire, un niveau.
* Une série est obligatoire pour les classes de lycée.
* Une seule année scolaire `ACTIVE` par établissement à la fois.
* `niveau_suivant_id` est NULL pour la Terminale (cas sortie).

---

# 15. Décisions MVP

| Sujet | Décision |
|---|---|
| Établissement complet/partiel | Supporté |
| Écosystème fermé | Oui |
| Niveaux personnalisables | Non — fixes Togo |
| Plusieurs classes par niveau | Oui |
| Séries lycée | Oui |
| Année scolaire obligatoire | Oui |
| Une seule année ACTIVE | Oui |
| Passage automatique | Oui — proposé, validé manuellement |
| Tarifs par classe | Oui |
| Progression inter-cycles | Via `niveau_suivant_id` |
| Multi-campus | Non MVP |

---

# 16. Hors MVP

Reporté :

* gestion multi-campus ;
* gestion d'établissements liés ;
* niveaux personnalisés ;
* programmes pédagogiques avancés.

---

# Résumé du domaine

```text
Etablissement
    ↓
Cycles
    ↓
Niveaux (séquencés par niveau_suivant_id)
    ↓
Classes (par année scolaire, avec tarifs)
    ↓
Elèves / Enseignants / Notes
```

Cette organisation constitue la base permettant de construire tous les autres modules.
