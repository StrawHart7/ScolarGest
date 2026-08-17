# 08 — Domaine métier : Gestion financière

## Frais scolaires, facturation, paiements, reçus & abonnement SaaS — Version 2.0

---

# 1. Objectif du domaine

Ce domaine gère les flux financiers liés à :

1. **L'établissement scolaire et ses élèves**
   * frais scolaires ;
   * facturation ;
   * paiements ;
   * reçus.

2. **Notre plateforme SaaS et les établissements clients**
   * abonnement logiciel ;
   * suivi des paiements ;
   * accès au service.

Ces deux parties sont séparées — elles représentent deux relations financières différentes.

---

# 2. Principes métier

## 2.1 Deux systèmes financiers indépendants

```text
Plateforme SaaS → Etablissements clients (abonnement)

Etablissement scolaire → Elèves / Responsables (frais scolaires)
```

Les paiements des parents envers l'école ne doivent jamais être mélangés avec les paiements de l'école envers notre SaaS.

## 2.2 Immuabilité des tarifs

Un `TarifScolaire` est **immuable après création**. Une erreur ou une modification nécessite la création d'un nouveau tarif, jamais la modification de l'existant. Cela garantit l'intégrité de l'historique financier.

## 2.3 Statuts de paiement informatifs

Les statuts de paiement (`PAYE`, `PARTIEL`, `IMPAYE`) sont **purement informatifs** — ils n'entraînent aucun blocage système automatique.

---

# PARTIE A — FINANCES DE L'ÉTABLISSEMENT

---

# 3. Frais scolaires

## Objectif

Définir ce que l'école demande financièrement aux élèves.

Exemples : scolarité, inscription, uniforme, transport, cantine, activités.

---

# 4. Entité TypeFrais

Représente une catégorie de frais.

```text
TypeFrais
---------
id
etablissement_id
nom
description
statut
```

---

# 5. Tarification scolaire — par classe

Les tarifs sont définis **par classe** (pas par niveau). Ils sont saisis lors de la création de chaque classe.

Exemple : Terminale D1 peut avoir un tarif différent de Terminale A4, même si elles sont dans le même niveau.

---

# 6. Entité TarifScolaire

```text
TarifScolaire
-------------
id
etablissement_id
annee_scolaire_id
classe_id           -- tarif par classe (décision v1)
type_frais_id
montant
```

**Règle d'immuabilité** : une fois créé, un `TarifScolaire` ne peut plus être modifié ni supprimé. Pour corriger une erreur, on crée un nouveau tarif et on documente l'ancien. Pas de workflow — interdiction pure et simple de modification.

---

# 7. Pourquoi l'année scolaire est obligatoire ?

Les prix changent d'une année à l'autre. L'historique doit être conservé.

```text
2025-2026 : Scolarité 6ème A → 200 000 FCFA
2026-2027 : Scolarité 6ème A → 230 000 FCFA
```

---

# 8. Facturation élève

## Objectif

Créer la dette d'un élève envers l'établissement.

## Génération automatique à l'inscription

À la validation de l'inscription d'un élève dans une classe, le système génère automatiquement la `FactureEleve` à partir des `TarifScolaire` de la classe. Le Comptable peut ensuite ajuster les lignes (remises, frais spéciaux, cas particuliers) avant de valider définitivement la facture.

## Structure

```text
FactureEleve
------------
id
etablissement_id
eleve_id
annee_scolaire_id
montant_total
statut
date_creation
```

---

# 9. LigneFacture

```text
LigneFacture
------------
id
facture_id
type_frais_id
designation
montant
```

Les lignes sont auto-générées depuis les `TarifScolaire` de la classe, puis éditables par le Comptable avant validation.

---

# 10. Exemple de facture

```text
Élève : Jean Dupont — 6ème A — 2026-2027

Scolarité      : 250 000 FCFA
Inscription    :  20 000 FCFA
──────────────────────────────
Total          : 270 000 FCFA
```

---

# 11. Paiement en plusieurs tranches

Le paiement par tranche est supporté (cas fréquent dans les écoles togolaises).

```text
Septembre : 100 000 FCFA
Janvier   :  80 000 FCFA
Mars      :  70 000 FCFA
Total     : 250 000 FCFA
```

---

# 12. Entité Paiement

```text
Paiement
--------
id
facture_id
montant
date_paiement
mode_paiement   -- ESPECES | CHEQUE | VIREMENT | MOBILE_MONEY | AUTRE
reference
statut          -- PAYE | PARTIEL | IMPAYE | ANNULE
```

**Rappel** : les statuts sont informatifs — ils n'entraînent aucun blocage.

---

# 13. Solde restant

```
Solde = Montant facture - Somme des paiements
```

---

# 14. Historique financier

Les paiements ne doivent pas être supprimés. Une correction crée :
1. une annulation du paiement existant (statut `ANNULE`) ;
2. un nouveau paiement avec les informations correctes.

---

# 15. Reçu de paiement

Chaque paiement peut générer un reçu PDF.

Informations :
* établissement (nom, logo) ;
* élève et responsable ;
* montant, date, mode de paiement ;
* référence ;
* numéro de reçu.

## Numérotation des reçus

Format : `REC-{annee_scolaire}-{sequence}`

Exemple : `REC-2025-001542`

* L'année est l'année de début de l'année scolaire
* La séquence est par établissement et repart à zéro chaque année scolaire

---

# 16. Statut paiement

| Statut | Signification |
|---|---|
| `PAYE` | Facture soldée |
| `PARTIEL` | Paiements partiels effectués |
| `IMPAYE` | Aucun paiement |
| `ANNULE` | Paiement annulé |

Ces statuts sont informatifs — aucun blocage système automatique.

---

# 17. Accès par rôle

| Rôle | Droits finance |
|---|---|
| DIRECTEUR | Lecture complète |
| COMPTABLE | Lecture + écriture complète (frais, factures, paiements, reçus) |
| SECRETAIRE | Lecture seule |
| ENSEIGNANT | Aucun accès |

---

# PARTIE B — ABONNEMENT SAAS

---

# 18. Objectif

Gérer la relation commerciale entre notre plateforme et les établissements clients.

---

# 19. Plans d'abonnement

```text
PlanAbonnement
--------------
id
nom
duree
prix
fonctionnalites
```

Exemples : Mensuel (25 000 FCFA/mois), Annuel (200 000 FCFA/an — réduction encourageant l'engagement long terme).

---

# 20. Abonnement établissement

```text
AbonnementEtablissement
-----------------------
id
etablissement_id
plan_id
date_debut
date_fin
statut
```

## Statuts d'abonnement

| Statut | Signification |
|---|---|
| `ACTIF` | Abonnement en cours |
| `EXPIRE` | Date de fin dépassée |
| `SUSPENDU` | Suspendu par le SUPER_ADMIN |

Le statut `ESSAI` est supprimé — il n'y a pas de self-service ni d'essai gratuit.

---

# 21. Paiement abonnement

```text
PaiementAbonnement
------------------
id
abonnement_id
montant
date
mode_paiement   -- VIREMENT | MOBILE_MONEY | AUTRE
reference
```

**Processus** : l'école effectue un virement ou un paiement Mobile Money, puis contacte notre équipe. Le SUPER_ADMIN valide manuellement dans le back-office. Le paiement intégré (automatique) est reporté à une version ultérieure.

---

# 22. Effet de l'expiration de l'abonnement

À définir lors de l'implémentation du back-office SUPER_ADMIN (comportement exact : blocage total, lecture seule ou bandeau d'avertissement).

---

# 23. Sécurité financière

Actions sensibles auditées dans `AuditLog` :

* création / modification de tarif ;
* création / annulation de facture ;
* enregistrement / annulation de paiement ;
* modification d'abonnement.

---

# 24. Relations principales

## Finances scolaires

```text
Eleve
    ↓
FactureEleve
    ↓ (1→N)
LigneFacture
FactureEleve
    ↓ (1→N)
Paiement
    ↓
Reçu (Document PDF)
```

## SaaS

```text
Etablissement
    ↓
AbonnementEtablissement
    ↓
PaiementAbonnement
```

---

# 25. Décisions MVP

| Sujet | Décision |
|---|---|
| Tarifs | Par classe — immuables après création |
| Facture | Auto-générée à l'inscription + ajustements Comptable |
| Paiement par tranche | Oui |
| Statuts paiement | Informatifs uniquement — pas de blocage |
| Reçu PDF | Oui |
| Numérotation reçus | Par établissement, par année scolaire |
| Abonnement essai | Supprimé — demande de démo uniquement |
| Paiement abonnement | Manuel, validé par SUPER_ADMIN |
| Paiement intégré | Reporté version ultérieure |
| Gestion salaires enseignants | Non MVP |

---

# 26. Hors MVP

Reporté :

* paiement parent en ligne ;
* relances automatiques ;
* SMS impayés ;
* comptabilité complète ;
* gestion fournisseurs ;
* gestion salaires ;
* rapprochement bancaire ;
* paiement d'abonnement intégré (Mobile Money automatique, Stripe).

---

# Résumé du domaine

```text
FINANCES ECOLE

TarifScolaire (par classe, immuable)
    ↓
FactureEleve (auto-générée + ajustable)
    ↓
LigneFacture
    ↓
Paiement(s)
    ↓
Reçu PDF


FINANCES SAAS

Etablissement
    ↓
AbonnementEtablissement
    ↓
PaiementAbonnement (validé manuellement par SUPER_ADMIN)
```
