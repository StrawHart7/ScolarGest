# 06 — Domaine métier : Enseignants, matières & affectations pédagogiques

## Gestion du personnel enseignant et de la répartition académique — Version 2.0

---

# 1. Objectif du domaine

Ce domaine gère tout ce qui concerne les enseignants dans l'établissement.

Il permet de gérer :

* l'identité des enseignants ;
* leurs informations administratives ;
* les matières qu'ils enseignent ;
* les classes auxquelles ils sont affectés ;
* leur rôle éventuel de professeur titulaire ;
* l'historique des affectations selon les années scolaires.

L'objectif principal est de répondre à une question essentielle :

> Quel enseignant enseigne quelle matière à quelle classe pendant quelle année scolaire ?

---

# 2. Principes métier

## 2.1 Un enseignant appartient à un établissement

Un enseignant est attaché à un seul établissement dans le MVP.

```text
Etablissement 1 → N Enseignants
```

## 2.2 Compte obligatoire pour tout enseignant actif

Tout enseignant avec le statut `ACTIF` doit posséder un compte Supabase Auth avec un email valide. Un email est donc obligatoire à la création d'un enseignant actif. C'est une exigence de traçabilité et de sécurité.

Le Directeur fournit l'email lors de la création. Supabase Auth envoie une invitation à cet email.

---

# 3. Entité Enseignant

## Rôle

Représente un membre du personnel enseignant.

## Structure

```text
Enseignant
----------
id
etablissement_id
utilisateur_id      -- obligatoire pour tout enseignant ACTIF (lien vers Utilisateur avec role ENSEIGNANT)
matricule
nom
prenoms
sexe
date_naissance
telephone
email               -- obligatoire pour tout enseignant ACTIF
adresse
date_embauche
statut
ancien_matricule    -- conservé lors d'un import
created_at
updated_at
```

---

# 4. Matricule enseignant

Généré automatiquement par le système.

Format : `ENS-{annee_scolaire}-{sequence}`

Exemple : `ENS-2025-0042`

* L'année dans le préfixe est l'**année de début de l'année scolaire**
* La séquence repart à zéro par établissement et par année scolaire

Lors d'un import Excel, l'ancien matricule peut être conservé dans `ancien_matricule`.

---

# 5. Statut enseignant

| Statut | Signification |
|---|---|
| `ACTIF` | En activité — compte Supabase Auth obligatoire |
| `INACTIF` | Compte conservé mais plus utilisé |
| `CONGE` | Absence temporaire |
| `DEPART` | Ancien enseignant |

---

# 6. Lien avec le compte utilisateur

Tout enseignant `ACTIF` doit avoir un `utilisateur_id` pointant vers un `Utilisateur` avec `role = ENSEIGNANT`.

```text
Enseignant (ACTIF)
    ↓ (obligatoire)
Utilisateur (role = ENSEIGNANT, clerk_user_id présent)
```

Ce lien garantit la traçabilité : on sait toujours qui a saisi quelle note.

---

# 7. Affectation pédagogique

## Élément central du domaine

Une affectation représente :

> Un enseignant enseigne une matière à une classe pendant une année scolaire.

## Structure

```text
AffectationEnseignant
---------------------
id
etablissement_id
annee_scolaire_id
enseignant_id
classe_id
matiere_id
```

L'affectation est la clé qui contrôle les droits de saisie de notes : un enseignant ne peut saisir des notes que sur les matières et classes qui lui sont affectées.

## Exemple concret

```text
Année 2026-2027
Classe : 6ème A
Matière : Mathématiques
Enseignant : M. Koffi
→ M. Koffi peut saisir des notes de Maths en 6ème A pour 2026-2027
```

---

# 8. Pourquoi l'année scolaire est obligatoire dans l'affectation ?

Les affectations changent régulièrement. L'historique doit être conservé.

```text
2025-2026 : Prof A enseigne Maths en 6ème A
2026-2027 : Prof B enseigne Maths en 6ème A
```

Une affectation terminée n'est jamais supprimée — elle reste dans l'historique.

---

# 9. Professeur titulaire

Un enseignant peut être responsable administratif d'une classe (professeur principal).

Ce rôle est **indépendant** de la matière enseignée.

```text
TitulariteClasse
----------------
id
annee_scolaire_id
classe_id
enseignant_id
```

Une classe a zéro ou un titulaire (zéro = configuration en cours ou école ne renseignant pas cette information).

---

# 10. Plusieurs enseignants par classe

Supporté : chaque matière peut avoir son propre enseignant.

```text
6ème A
Maths → Prof A
Français → Prof B
Histoire → Prof C
```

---

# 11. Plusieurs classes par enseignant

Supporté : un enseignant peut enseigner dans plusieurs classes.

```text
Professeur Mathématiques
6ème A, 6ème B, 5ème C
```

---

# 12. Enseignant polyvalent (primaire)

Cas fréquent : un instituteur enseigne plusieurs matières dans la même classe. Le modèle le permet via plusieurs `AffectationEnseignant`.

---

# 13. Import Excel enseignants

Données possibles à l'import : nom, prénom, téléphone, email, matière, classe.

```text
Excel
    ↓
Correspondance champs
    ↓
Validation (email obligatoire pour ACTIF)
    ↓
Création enseignants + Invitations Supabase Auth
    ↓
Création affectations
```

---

# 14. Sécurité

Un enseignant connecté :

**Peut** :
* voir ses classes affectées ;
* saisir des notes sur ses matières affectées ;
* consulter les élèves de ses classes ;
* soumettre une demande de modification de note.

**Ne peut pas** :
* modifier des paiements ;
* voir des données d'une autre école ;
* modifier ses propres affectations ;
* accéder aux classes non affectées.

---

# 15. Décisions MVP

| Sujet | Décision |
|---|---|
| Enseignant par établissement | Oui |
| Enseignant multi-écoles | Non MVP |
| Affectation annuelle | Oui |
| Matière + classe + année obligatoire | Oui |
| Professeur titulaire | Oui |
| Plusieurs enseignants/classe | Oui |
| Plusieurs classes/professeur | Oui |
| Compte enseignant | Obligatoire pour tout enseignant ACTIF |
| Affectation → droits de saisie | Oui — contrôle explicite |
| Import Excel | Prévu |

---

# 16. Hors MVP

Reporté :

* gestion contrats enseignants ;
* salaires ;
* absences enseignants ;
* évaluations enseignants ;
* remplacement automatique ;
* planning horaire.

---

# Résumé du domaine

```text
Année scolaire
    +
Classe
    +
Matière
    +
Enseignant (avec compte Supabase Auth obligatoire)
    ↓
AffectationEnseignant
    ↓
Droits de saisie de notes
```

C'est l'entité d'affectation qui permet de gérer correctement les changements annuels sans casser l'historique, et qui contrôle précisément qui peut saisir quoi.
