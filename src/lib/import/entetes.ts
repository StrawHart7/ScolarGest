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

/** Nombre de motifs distincts détaillés dans le résumé envoyé au support. */
const MOTIFS_DETAILLES = 5;

/**
 * Phrase prête à envoyer au support quand ce sont les **lignes** qui sont
 * refusées, en-têtes conformes.
 *
 * Elle regroupe par motif au lieu d'énumérer les lignes. Un fichier dont deux
 * cent soixante-six lignes portent quatre motifs distincts se diagnostique en
 * lisant les quatre ; recopier les deux cent soixante-six produirait une
 * demande que personne ne lit, et une pièce jointe qui dit déjà tout.
 *
 * Le libellé d'une ligne est écarté : il porte le nom d'un élève, et le résumé
 * part dans le corps d'une demande de support. La pièce jointe, elle, est
 * délibérée et le fichier entier y est déjà.
 */
export function resumeRefusPourSupport(
  refusees: { motif: string }[],
  nombreRefusees: number,
  nombreTotal: number,
): string {
  const parMotif = new Map<string, number>();
  for (const l of refusees) parMotif.set(l.motif, (parMotif.get(l.motif) ?? 0) + 1);

  const classes = [...parMotif.entries()].sort((a, b) => b[1] - a[1]);
  const lignes = [`${nombreRefusees} ligne(s) refusée(s) sur ${nombreTotal}. Motifs :`];
  for (const [motif, nombre] of classes.slice(0, MOTIFS_DETAILLES)) {
    lignes.push(`- ${nombre} × ${motif}`);
  }
  if (classes.length > MOTIFS_DETAILLES) {
    lignes.push(`- et ${classes.length - MOTIFS_DETAILLES} autre(s) motif(s)`);
  }
  return lignes.join('\n');
}
