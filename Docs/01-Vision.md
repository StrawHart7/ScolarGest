# 01 — Vision du projet

## Document de vision produit — Version 2.0

---

# 1. Présentation du projet

## 1.1 Contexte

Les établissements scolaires privés, particulièrement en Afrique de l'Ouest, utilisent encore largement des méthodes manuelles ou des outils fragmentés pour gérer leur administration :

* fichiers Excel ;
* cahiers papier ;
* documents Word ;
* logiciels locaux peu évolutifs.

Ces méthodes entraînent plusieurs difficultés :

* perte d'informations ;
* erreurs de calcul ;
* manque de visibilité financière ;
* difficulté à produire rapidement des documents officiels ;
* absence d'une vision globale de l'établissement.

Le projet consiste à développer une plateforme SaaS permettant aux établissements scolaires privés de centraliser leur gestion administrative et académique.

---

# 2. Vision

Créer une plateforme de gestion scolaire fiable, accessible et évolutive permettant aux écoles privées de gérer leur fonctionnement quotidien depuis un environnement numérique unique.

La plateforme doit devenir progressivement un système central autour duquel gravitent :

* l'administration ;
* les enseignants ;
* les élèves ;
* les responsables légaux ;
* les services scolaires.

---

# 3. Positionnement produit

Le produit n'est pas conçu initialement comme un réseau social scolaire ou une plateforme communautaire.

La priorité est :

> Remplacer les outils administratifs dispersés par un système centralisé, fiable et professionnel.

Le produit commence par le cœur administratif :

* gestion des élèves ;
* gestion des classes ;
* gestion des enseignants ;
* gestion des notes ;
* bulletins ;
* paiements.

Les fonctionnalités sociales et collaboratives seront développées progressivement.

---

# 4. Public cible

## Client principal

Établissements scolaires privés :

* maternelles ;
* écoles primaires ;
* collèges ;
* lycées.

Le système doit supporter :

* les établissements complets (maternelle → lycée) ;
* les établissements partiels (ex : collège uniquement).

Marché initial : Togo (Afrique de l'Ouest). Priorité opérationnelle : collèges.

---

# 5. Philosophie MVP

Le MVP doit être :

* suffisamment complet pour être vendu ;
* suffisamment simple pour être développé rapidement ;
* suffisamment robuste pour évoluer.

Le MVP ne cherche pas à couvrir toute la vie scolaire.

Il cherche à construire :

> Le noyau administratif numérique d'une école.

---

# 6. Périmètre MVP

## Inclus

### Gestion établissement

* établissement ;
* année scolaire ;
* cycles ;
* niveaux ;
* classes ;
* paramètres.

### Gestion utilisateurs

* comptes (via Clerk) ;
* rôles fixes ;
* permissions ;
* sécurité.

### Gestion élèves

* élèves ;
* responsables légaux ;
* inscriptions ;
* affectation aux classes.

### Gestion enseignants

* enseignants (avec compte obligatoire) ;
* affectations annuelles ;
* matières enseignées ;
* professeur titulaire.

### Gestion académique

* matières ;
* coefficients (historisés par année scolaire) ;
* évaluations ;
* calcul des moyennes ;
* bulletins PDF ;
* workflow de modification de note (validation Secrétaire).

### Gestion financière

* frais scolaires (immuables après création) ;
* tarifs par classe ;
* factures (auto-générées à l'inscription, ajustables) ;
* paiements ;
* reçus.

### SaaS

* établissements clients (création manuelle par SUPER_ADMIN) ;
* abonnements (paiement manuel validé par SUPER_ADMIN) ;
* isolation des données.

---

# 7. Fonctionnalités volontairement reportées

## Vie scolaire

* absences avancées ;
* suivi comportemental ;
* sanctions détaillées ;
* carnet scolaire numérique.

## Communication

* messagerie ;
* notifications ;
* annonces ;
* espace parent.

## Organisation

* emploi du temps ;
* gestion des salles ;
* planning avancé.

## Intelligence

* IA ;
* prédictions ;
* analyses avancées.

## Autres

* mode hors-ligne / synchronisation ;
* paiement d'abonnement en ligne (Mobile Money, Stripe) ;
* portail parent ;
* livret de compétences maternelle/primaire.

---

# 8. Principes fondamentaux

## 8.1 Écosystème fermé

Chaque établissement fonctionne indépendamment.

Un utilisateur appartient à un seul établissement.

Les données d'un établissement ne sont jamais mélangées avec celles d'un autre.

---

## 8.2 Multi-tenant

La plateforme accueille plusieurs établissements.

Architecture retenue :

* une base de données commune ;
* isolation logique par `etablissement_id` ;
* couche d'accès centralisée (repository pattern) — chaque requête filtre obligatoirement par tenant.

---

## 8.3 Scalabilité

Le modèle doit permettre d'ajouter progressivement :

* applications mobiles ;
* portail parents ;
* communication ;
* statistiques avancées ;
* nouveaux services.

---

## 8.4 Simplicité opérationnelle

Le logiciel doit être accessible aux utilisateurs non techniques.

La complexité doit être gérée par la plateforme, pas par l'école.

---

# 9. Modèle commercial

Le produit fonctionne sous forme d'abonnement SaaS.

## Accès

Pas de self-service. Toute école passe par une **demande de démo** :

1. L'école contacte notre équipe.
2. Notre équipe valide et configure l'environnement.
3. Le compte Directeur est créé et l'invitation Clerk est envoyée.
4. L'école commence son utilisation.

## Paiement de l'abonnement

Virement ou Mobile Money, validé manuellement par le SUPER_ADMIN dans le back-office.

Le paiement intégré (automatique) est reporté à une version ultérieure.

## Plans

| Durée | Exemple de tarif |
|---|---|
| Mensuel | 25 000 FCFA / mois |
| Annuel | 200 000 FCFA / an |

L'abonnement annuel bénéficie d'une réduction afin d'encourager l'engagement long terme.

---

# 10. Objectif final

Construire progressivement une plateforme complète de gestion scolaire capable de devenir l'infrastructure numérique principale des établissements privés.

La première étape reste cependant claire :

> Construire le meilleur noyau administratif possible avant d'étendre vers la vie scolaire et la communauté.
