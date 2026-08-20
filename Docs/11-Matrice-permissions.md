# Matrice des permissions

> Généré par `npx tsx scripts/matrice-permissions.ts` à partir des gardes
> `requireRole(...)` de `src/services/`. Ne pas modifier à la main : c'est le code
> qui fait foi, et `matrice-permissions.test.ts` compare les deux.

Légende : `X` autorisé, `·` refusé.

| Service | Fonction | SUPER_ADMIN | DIRECTEUR | SECRETAIRE | COMPTABLE | ENSEIGNANT |
|---|---|---|---|---|---|---|
| `abonnement` | `createAbonnement` | X | · | · | · | · |
| `abonnement` | `expirerAbonnementsEchus` | X | · | · | · | · |
| `abonnement` | `getAbonnementCourant` | X | X | X | X | X |
| `abonnement` | `getAccesAbonnementCourant` _(session requise, tous rôles)_ | ? | ? | ? | ? | ? |
| `abonnement` | `listAbonnements` | X | · | · | · | · |
| `abonnement` | `listAbonnementsParEtablissement` | X | · | · | · | · |
| `abonnement` | `listPaiementsAbonnement` | X | X | · | · | · |
| `abonnement` | `listPlans` | X | X | X | X | X |
| `abonnement` | `peutEcrire` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `abonnement` | `reactiverAbonnement` | X | · | · | · | · |
| `abonnement` | `renouvelerAbonnement` | X | · | · | · | · |
| `abonnement` | `suspendreAbonnement` | X | · | · | · | · |
| `abonnement` | `validerPaiement` | X | · | · | · | · |
| `abonnement-acces` | `ecritureAutorisee` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `abonnement-acces` | `evaluerAcces` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `abonnement-acces` | `joursAvantEcheance` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `abonnement-acces` | `statutEffectif` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `affectation` | `creerAffectation` | X | X | X | · | · |
| `affectation` | `listAffectationsClasse` | X | X | X | · | X |
| `affectation` | `listAffectationsEnseignant` | X | X | X | · | X |
| `affectation` | `listMesAffectations` | X | · | · | · | X |
| `affectation` | `supprimerAffectation` | X | X | X | · | · |
| `annee-scolaire` | `activerAnneeScolaire` | X | X | · | · | · |
| `annee-scolaire` | `bilanCloture` | X | X | · | · | · |
| `annee-scolaire` | `cloturerAnneeScolaire` | X | X | · | · | · |
| `annee-scolaire` | `createAnneeScolaire` | X | X | · | · | · |
| `annee-scolaire` | `getAnneeScolaire` | X | X | X | X | X |
| `annee-scolaire` | `listAnneesScolaires` | X | X | X | X | X |
| `audit` | `auditLog` _(session requise, tous rôles)_ | ? | ? | ? | ? | ? |
| `audit` | `journaliserConnexion` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `authorization` | `requireRole` _(rôles dynamiques — à revoir)_ | ? | ? | ? | ? | ? |
| `bulletin` | `genererBulletin` | X | X | X | · | · |
| `bulletin` | `regenererBulletin` | X | X | X | · | · |
| `bulletin-donnees` | `getDonneesBulletin` | X | X | X | · | · |
| `classe` | `createClasse` | X | X | · | · | · |
| `classe` | `getClasse` | X | X | X | X | · |
| `classe` | `listClasses` | X | X | X | X | · |
| `coefficient` | `definirCoefficient` | X | X | X | · | · |
| `coefficient` | `definirCoefficients` | X | X | X | · | · |
| `coefficient` | `getCoefficient` | X | X | X | · | X |
| `coefficient` | `listCoefficients` | X | X | X | · | X |
| `dashboard` | `getAnneeCourante` _(session requise, tous rôles)_ | ? | ? | ? | ? | ? |
| `dashboard` | `getDashboardComptable` | X | · | · | X | · |
| `dashboard` | `getDashboardDirecteur` | X | X | · | · | · |
| `dashboard` | `getDashboardEnseignant` | X | · | · | · | X |
| `dashboard` | `getDashboardSecretaire` | X | · | X | · | · |
| `dashboard` | `getFluxActivite` | X | X | · | · | · |
| `document` | `enregistrerDocument` | X | X | X | X | · |
| `document` | `getDocument` | X | X | X | X | X |
| `document` | `getUrlTelechargementDocument` _(garde héritée de `getDocument`)_ | ? | ? | ? | ? | ? |
| `document` | `listDocumentsEleve` | X | X | X | · | X |
| `document` | `listDocumentsParType` | X | X | X | X | · |
| `document` | `marquerObsolete` | X | X | X | X | · |
| `document-numero` | `generateNumeroDocument` _(session requise, tous rôles)_ | ? | ? | ? | ? | ? |
| `eleve` | `archiverEleve` | X | X | X | · | · |
| `eleve` | `createEleveAvecResponsables` | X | X | X | · | · |
| `eleve` | `getEleve` | X | X | X | X | · |
| `eleve` | `listEleves` | X | X | X | X | · |
| `eleve` | `listElevesInscritsClasse` | X | X | X | · | X |
| `eleve` | `listElevesPage` | X | X | X | X | · |
| `eleve` | `updateEleve` | X | X | X | · | · |
| `enseignant` | `createEnseignant` | X | X | X | · | · |
| `enseignant` | `desactiverEnseignant` | X | X | X | · | · |
| `enseignant` | `getEnseignant` | X | X | X | · | X |
| `enseignant` | `getEnseignantParUtilisateur` | X | X | X | · | X |
| `enseignant` | `listEnseignants` | X | X | X | · | X |
| `enseignant` | `updateEnseignant` | X | X | X | · | · |
| `etablissement` | `createEtablissement` | X | · | · | · | · |
| `etablissement` | `getEtablissement` | X | X | X | X | X |
| `etablissement` | `listEtablissements` | X | · | · | · | · |
| `evaluation` | `creerEvaluation` | X | X | X | · | X |
| `evaluation` | `listEvaluations` | X | X | X | · | X |
| `evaluation` | `supprimerEvaluation` | X | X | X | · | X |
| `evaluation-detail` | `getEvaluationDetail` | X | X | X | · | X |
| `facture` | `annulerFacture` | X | · | · | X | · |
| `facture` | `calculerSolde` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `facture` | `calculerSoldeFacture` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `facture` | `getFactureDetail` | X | X | X | X | · |
| `facture` | `getFacturesEleve` | X | X | X | X | · |
| `facture` | `listSuiviPaiements` | X | X | X | X | · |
| `facture` | `modifierLignesFacture` | X | · | · | X | · |
| `facture` | `statutFacture` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `facture` | `totalPaye` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `facture` | `totauxSuivi` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `import-eleves` | `importerLignesValides` | X | X | X | · | · |
| `import-eleves` | `parseFichierExcel` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `import-eleves` | `validerLignes` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `import-enseignants` | `importerLignesValides` | X | X | X | · | · |
| `import-enseignants` | `parseFichierExcel` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `import-enseignants` | `validerLignes` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `import-paiements` | `importerLignesValides` | X | · | · | X | · |
| `import-paiements` | `parseFichierExcel` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `import-paiements` | `validerLignes` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `inscription` | `annulerInscription` | X | X | X | · | · |
| `inscription` | `cloturerInscription` | X | X | X | · | · |
| `inscription` | `creerInscriptionAvecFacture` | X | X | X | · | · |
| `inscription` | `getInscriptionEleve` | X | X | X | X | · |
| `inscription` | `listInscriptions` | X | X | X | X | · |
| `inscription` | `reinscrireEleve` | X | X | X | · | · |
| `matiere` | `createMatiere` | X | X | X | · | · |
| `matiere` | `getMatiere` | X | X | X | · | X |
| `matiere` | `listMatieres` | X | X | X | · | X |
| `matiere` | `updateMatiere` | X | X | X | · | · |
| `matricule` | `generateMatriculeEleve` _(session requise, tous rôles)_ | ? | ? | ? | ? | ? |
| `matricule` | `generateMatriculeEnseignant` _(session requise, tous rôles)_ | ? | ? | ? | ? | ? |
| `note` | `approuverModification` _(garde héritée de `verifierPin`)_ | ? | ? | ? | ? | ? |
| `note` | `demanderModification` | X | X | X | · | X |
| `note` | `getClassementClasse` _(garde héritée de `getResultatsClasse`)_ | ? | ? | ? | ? | ? |
| `note` | `getMoyennesEleve` | X | X | X | · | X |
| `note` | `listNotesEnAttente` | X | · | X | · | · |
| `note` | `listNotesEvaluation` | X | X | X | · | X |
| `note` | `rejeterModification` _(garde héritée de `verifierPin`)_ | ? | ? | ? | ? | ? |
| `note` | `saisirNote` | X | · | · | · | X |
| `note` | `soumettreNotes` | X | X | X | · | X |
| `paiement` | `annulerPaiement` | X | · | · | X | · |
| `paiement` | `enregistrerPaiement` | X | · | · | X | · |
| `paiement` | `getPaiementDetail` | X | X | X | X | · |
| `paiement` | `listPaiements` | X | X | X | X | · |
| `passage-annee` | `listInscriptionsACloturer` | X | X | X | · | · |
| `passage-annee` | `proposerDecisions` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `passage-annee` | `validerPassageCohorte` | X | X | X | · | · |
| `pin` | `exigerPin` _(rôles dynamiques — à revoir)_ | ? | ? | ? | ? | ? |
| `pin` | `hashPin` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `pin` | `verifyPin` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `programme` | `ajouterMatiereAuProgramme` | X | X | X | · | · |
| `programme` | `listProgramme` | X | X | X | · | X |
| `programme` | `retirerDuProgramme` | X | X | X | · | · |
| `rapport` | `construireRapport` _(rôles dynamiques — à revoir)_ | ? | ? | ? | ? | ? |
| `rapport` | `definitionRapport` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `rapport` | `rapportsAutorises` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `recherche-globale` | `rechercheGlobale` | X | X | X | X | X |
| `recu` | `genererRecuPaiement` | X | X | X | X | · |
| `responsable` | `linkResponsableEleve` | X | X | X | · | · |
| `responsable` | `listResponsablesEleve` | X | X | X | X | · |
| `responsable` | `updateResponsable` | X | X | X | · | · |
| `resultats-classe` | `getResultatsClasse` | X | X | X | · | X |
| `structure` | `activerCycle` | X | X | · | · | · |
| `structure` | `listCycles` | X | X | X | X | X |
| `structure` | `listCyclesActifs` | X | X | X | X | X |
| `structure` | `listNiveauxParCycle` | X | X | X | X | X |
| `structure` | `listSeriesParCycle` | X | X | X | X | X |
| `tarif` | `createTarif` | X | · | · | X | · |
| `tarif` | `listTarifs` | X | X | X | X | · |
| `tarif` | `totalTarifs` _(aucune garde)_ | ? | ? | ? | ? | ? |
| `tenant` | `getTenantContext` _(session requise, tous rôles)_ | ? | ? | ? | ? | ? |
| `titularite` | `definirTitulaire` | X | X | X | · | · |
| `titularite` | `getTitulaire` | X | X | X | · | X |
| `titularite` | `retirerTitulaire` | X | X | X | · | · |
| `type-frais` | `createTypeFrais` | X | · | · | X | · |
| `type-frais` | `listTypesFrais` | X | X | X | X | · |
| `type-frais` | `updateTypeFrais` | X | · | · | X | · |
| `utilisateur` | `definirPin` | X | X | X | · | · |
| `utilisateur` | `desactiverUtilisateur` | X | X | · | · | · |
| `utilisateur` | `getMonProfil` _(session requise, tous rôles)_ | ? | ? | ? | ? | ? |
| `utilisateur` | `getUtilisateur` | X | X | · | · | · |
| `utilisateur` | `inviteUtilisateur` _(garde conditionnelle — union des branches)_ | X | X | · | · | · |
| `utilisateur` | `listUtilisateurs` | X | X | · | · | · |
| `utilisateur` | `listUtilisateursParEtablissement` | X | · | · | · | · |
