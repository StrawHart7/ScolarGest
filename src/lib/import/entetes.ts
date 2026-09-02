/**
 * Contrôle des en-têtes d'un fichier d'import.
 *
 * **Ce module ne dépend de rien**, délibérément : l'écran d'import l'affiche
 * côté client, et y importer un service ferait remonter `next/headers` dans le
 * bundle — c'est la panne du 2026-09-02 sur le contact support. Ne jamais
 * importer `xlsx` ni un service ici.
 *
 * Pourquoi un contrôle séparé de la validation Zod : quand les colonnes ne
 * correspondent pas, Zod produit une erreur *par ligne et par champ*. Un
 * fichier de 230 élèves dont l'en-tête dit « Date de naissance » au lieu de
 * `date_naissance` génère 230 erreurs identiques et illisibles, alors qu'il n'y
 * a qu'un seul problème, situé en ligne 1. Le diagnostic doit être posé avant
 * de regarder la moindre ligne de données.
 */

export interface AnalyseEntetes {
  /** Toutes les colonnes attendues sont présentes. */
  conforme: boolean;
  /** Colonnes attendues absentes du fichier. C'est ce qui bloque. */
  manquantes: string[];
  /**
   * Colonnes présentes dans le fichier et inconnues du gabarit. Elles ne
   * bloquent pas — on les ignore — mais les afficher aide : c'est souvent là
   * qu'on voit qu'une colonne a simplement été renommée.
   */
  inattendues: string[];
  /** En-têtes réellement lus, dans l'ordre du fichier. */
  trouvees: string[];
}

/**
 * Normalise un en-tête pour la comparaison : espaces de bord retirés, minuscules.
 *
 * Volontairement tolérant sur la casse seulement. Aller plus loin — accents,
 * espaces convertis en tirets bas — reviendrait à deviner l'intention, et un
 * gabarit qu'on croit souple mais qui ne l'est qu'à moitié est pire qu'un
 * gabarit strict : l'utilisateur ne sait plus ce qui est accepté.
 */
export function normaliserEntete(entete: string): string {
  return entete.trim().toLowerCase();
}

export function analyserEntetes(
  trouvees: string[],
  attendues: readonly string[],
): AnalyseEntetes {
  const normaliseesTrouvees = new Set(trouvees.map(normaliserEntete).filter((e) => e !== ''));

  const manquantes = attendues.filter((col) => !normaliseesTrouvees.has(normaliserEntete(col)));

  const attenduesNormalisees = new Set(attendues.map(normaliserEntete));
  const inattendues = trouvees.filter((e) => {
    const n = normaliserEntete(e);
    return n !== '' && !attenduesNormalisees.has(n);
  });

  return {
    conforme: manquantes.length === 0,
    manquantes,
    inattendues,
    trouvees,
  };
}

/**
 * Phrase prête à envoyer au support, listant ce qui manque.
 *
 * Construite ici plutôt que dans l'écran : c'est le même texte qui préremplit
 * la demande de support, et le dupliquer les ferait diverger.
 */
export function resumeEntetesPourSupport(analyse: AnalyseEntetes): string {
  const lignes = [
    `Colonnes manquantes : ${analyse.manquantes.join(', ') || 'aucune'}`,
    `Colonnes trouvées dans le fichier : ${analyse.trouvees.join(', ') || 'aucune'}`,
  ];
  if (analyse.inattendues.length > 0) {
    lignes.push(`Colonnes non reconnues : ${analyse.inattendues.join(', ')}`);
  }
  return lignes.join('\n');
}
