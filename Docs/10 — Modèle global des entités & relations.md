# 10 — Modèle global des entités & relations

## Architecture métier consolidée (ERD conceptuel) — Version 2.0

---

# 1. Objectif

Cette étape fusionne tous les domaines validés pour obtenir une vision globale du noyau métier.

Objectif :

* vérifier que toutes les entités s'assemblent correctement ;
* éviter les incohérences ;
* préparer la conception du schéma Prisma ;
* servir de référence avant développement.

---

# 2. Principe architectural principal

> Chaque établissement possède un environnement complètement isolé.

```text
SaaS ScoolAdmin
        |
 -------+-------
 |              |
EcoleA        EcoleB
 |              |
Données       Données
isolées       isolées
```

Aucune relation métier entre établissements. Isolation garantie par repository pattern (filtre `etablissement_id` sur chaque requête).

---

# 3. Vue générale des domaines

```text
ETABLISSEMENT
        |
 -------+--------+----------+
 |               |          |
Structure    Utilisateurs  Finance SaaS
 |
AnneeScolaire
 |
Classes
 |
 +----------+
 |          |
Elèves   Enseignants
 |          |
Inscription Affectation
 |
Notes
 |
Bulletins
```

---

# 4. Domaine Établissement

## Entités

```text
Etablissement
Cycle
CycleEtablissement
AnneeScolaire
```

## Relations

```text
Etablissement 1 → N AnneeScolaire
Etablissement N ↔ N Cycle (via CycleEtablissement)
```

**Contrainte** : une seule `AnneeScolaire` avec statut `ACTIVE` par établissement.

---

# 5. Domaine Structure scolaire

## Entités

```text
Niveau      (avec niveau_suivant_id pour séquence inter-cycles)
Serie
Classe      (avec tarifs associés)
```

## Relations

```text
Cycle 1 → N Niveau
Niveau 1 → N Classe
Serie 1 → N Classe (optionnel — lycée uniquement)
AnneeScolaire 1 → N Classe
```

Une classe appartient obligatoirement à : un établissement, une année scolaire, un niveau.

---

# 6. Domaine Élèves

## Entités

```text
Eleve
Responsable
EleveResponsable
Inscription
```

## Relations

```text
Etablissement 1 → N Eleve
Eleve 1 → N Inscription
Inscription N → 1 Classe
Eleve N ↔ N Responsable (via EleveResponsable)
Inscription 1 → 1 FactureEleve (auto-générée à l'inscription)
```

---

# 7. Domaine Enseignants

## Entités

```text
Enseignant    (avec utilisateur_id obligatoire si ACTIF)
AffectationEnseignant
TitulariteClasse
```

## Relations

```text
Etablissement 1 → N Enseignant
Enseignant 1 → 1 Utilisateur (si ACTIF)
Enseignant 1 → N AffectationEnseignant
AffectationEnseignant = Enseignant + Classe + Matiere + AnneeScolaire
Classe 1 → 0..1 TitulariteClasse
```

L'affectation contrôle les droits de saisie de notes.

---

# 8. Domaine Académique

## Entités

```text
Matiere
ProgrammeEtablissement    (matière par niveau dans un établissement)
CoefficientMatiere        (historisé par annee_scolaire_id)
Evaluation
Note                      (avec statut de workflow)
```

## Relations

```text
Etablissement 1 → N ProgrammeEtablissement (Niveau + Matiere)
ProgrammeEtablissement + Serie + AnneeScolaire → CoefficientMatiere
Classe + Matiere + AnneeScolaire → Evaluation
Evaluation 1 → N Note
Note N → 1 Eleve
```

## Statuts Note

```text
BROUILLON → SOUMISE → EN_ATTENTE → VALIDE | REJETE
```

Le workflow EN_ATTENTE est déclenché quand un Enseignant modifie une note SOUMISE. La Secrétaire approuve avec PIN.

---

# 9. Domaine Finance école

## Entités

```text
TypeFrais
TarifScolaire     (par classe, immuable)
FactureEleve
LigneFacture
Paiement
```

## Relations

```text
Classe + TypeFrais + AnneeScolaire → TarifScolaire (immuable)
Eleve 1 → N FactureEleve
FactureEleve 1 → N LigneFacture
FactureEleve 1 → N Paiement
```

**TarifScolaire** référence `classe_id` (pas `niveau_id`).

**Immuabilité** : aucune modification de `TarifScolaire` après création. Correction = nouveau tarif.

---

# 10. Domaine Documents

## Entités

```text
Document    (référence + métadonnées + chemin Supabase Storage)
```

```text
Document
--------
id
etablissement_id
type              -- BULLETIN | RECU | RAPPORT
reference         -- ex. BUL-2025-000125
chemin_fichier
objet_type
objet_id
date_generation
created_by
statut            -- GENERE | OBSOLETE | ARCHIVE
```

Numérotation par établissement et par année scolaire (préfixe = année de début d'année scolaire).

---

# 11. Domaine SaaS

## Entités

```text
PlanAbonnement
AbonnementEtablissement
PaiementAbonnement
```

## Relations

```text
Etablissement 1 → N AbonnementEtablissement
AbonnementEtablissement 1 → N PaiementAbonnement
```

Statuts abonnement : `ACTIF | EXPIRE | SUSPENDU` (le statut `ESSAI` est supprimé).

---

# 12. Domaine Sécurité & Identité

## Entités

```text
Utilisateur   (avec clerk_user_id + pin_approbation_hash)
AuditLog
```

```text
Utilisateur
-----------
id                   -- même UUID que auth.users.id (Supabase Auth)
etablissement_id
nom
prenom
email
telephone
role                 -- SUPER_ADMIN | DIRECTEUR | SECRETAIRE | COMPTABLE | ENSEIGNANT
statut               -- ACTIF | INACTIF | BLOQUE
pin_approbation_hash
dernier_acces
created_at
updated_at
```

## Relations

```text
Etablissement 1 → N Utilisateur
Utilisateur 1 → 0..1 Enseignant (si role = ENSEIGNANT)
```

---

# 13. Rôles (5 rôles fixes)

| Rôle | Description |
|---|---|
| `SUPER_ADMIN` | Gestion plateforme SaaS |
| `DIRECTEUR` | Administration école + lecture globale |
| `SECRETAIRE` | Gestion admin + approbation notes (PIN requis) |
| `COMPTABLE` | Gestion financière complète |
| `ENSEIGNANT` | Saisie notes sur classes affectées |

---

# 14. Entités transversales

## AuditLog

```text
AuditLog
--------
id
etablissement_id
user_id
action
module
objet_type
objet_id
ancienne_valeur
nouvelle_valeur
date
```

Obligatoire pour : connexion, création utilisateur, modification paiement, modification note, validation approbation, génération bulletin.

---

# 15. Workflow d'approbation — entité transverse

Le seul vrai workflow de la v1 porte sur les notes.

```text
Note (statut EN_ATTENTE)
→ Secrétaire voit la file d'approbation
→ Secrétaire saisit PIN (step-up auth)
→ Action : VALIDE | REJETE
→ Note change de statut
→ AuditLog enregistre l'action
```

---

# 16. Relations majeures finales

```text
ETABLISSEMENT
    |
    +------ ANNEE_SCOLAIRE
    |           |
    |        CLASSE (+ TarifScolaire par classe)
    |           |
    |    +------+------+
    |    |             |
    |  ELEVE       ENSEIGNANT (avec compte Clerk)
    |    |             |
    | INSCRIPTION  AFFECTATION (droits saisie)
    |    |
    |  EVALUATION
    |    |
    |   NOTE (BROUILLON → SOUMISE → EN_ATTENTE → VALIDE)
    |    |
    | BULLETIN (PDF)
    |
    +------ UTILISATEUR (Clerk + PIN)
    |
    +------ ABONNEMENT (paiement manuel)
```

---

# 17. Flux annuel d'une école

## Début d'année

```text
Création année scolaire (PREPARATION → ACTIVE)
    ↓
Création classes (avec tarifs par classe)
    ↓
Configuration ProgrammeEtablissement + CoefficientMatiere (nouvelle année)
    ↓
Affectation enseignants
    ↓
Inscription élèves (+ génération auto des factures)
```

## Pendant l'année

```text
Evaluations → Notes (BROUILLON → SOUMISE)
    ↓
Workflow si modification post-soumission (EN_ATTENTE → VALIDE/REJETE)
    ↓
Calcul moyennes
    ↓
Génération bulletins PDF (Secrétaire)
    ↓
Paiements + reçus (Comptable)
```

## Fin d'année

```text
Résultats consolidés (T1 + T2 + T3)
    ↓
Décision passage (Admis / Redoublant / Départ)
    ↓
Passage automatique proposé → validé par Directeur/Secrétaire
    ↓
Clôture année (ACTIVE → TERMINEE)
    ↓
Création nouvelle année scolaire
```

---

# 18. Vérifications architecturales

| Sujet | Validation |
|---|---|
| Multi-tenant SaaS | ✓ |
| Isolation établissements (repository) | ✓ |
| Historisation annuelle (inscriptions, affectations, coefficients) | ✓ |
| Classes dynamiques par année | ✓ |
| Enseignants affectés annuellement | ✓ |
| Tarifs par classe (immuables) | ✓ |
| Coefficients historisés par année scolaire | ✓ |
| Matières personnalisables | ✓ |
| Paiement par tranche | ✓ |
| PDF générés server-side | ✓ |
| Import Excel avec validation | ✓ |
| 5 rôles fixes | ✓ |
| Clerk + PIN step-up | ✓ |
| Workflow note (Secrétaire + PIN) | ✓ |
| Numérotation par établissement/année | ✓ |
| Progression niveaux (niveau_suivant_id) | ✓ |
| Une seule année ACTIVE par école | ✓ |
| Pas de suppression destructive (données sensibles) | ✓ |

---

# Conclusion

Le noyau métier validé est suffisamment robuste pour construire un vrai SaaS scolaire. La décision stratégique a été de construire un **ERP scolaire administratif solide** avant d'envisager des fonctionnalités communautaires ou sociales.

Toutes les décisions de conception (Q0–Q17) sont documentées dans `analysis.md`.

La prochaine étape est la traduction de ce modèle conceptuel en schéma Prisma (Phase 0 de `PLAN.md`).
