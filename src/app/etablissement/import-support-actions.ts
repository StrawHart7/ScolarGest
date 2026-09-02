'use server';

import { z } from 'zod';
import { creerDemandeSupport } from '@/services/support';
import { TAILLE_MAX_PIECE_JOINTE } from '@/lib/support';

/**
 * Signaler au support un fichier d'import dont les colonnes ne correspondent pas.
 *
 * Partagée par les trois écrans d'import — élèves, enseignants, paiements —
 * d'où sa place hors d'un dossier de route, sur le modèle de
 * `src/app/demande-demo-actions.ts`.
 *
 * **Le fichier part avec la demande.** Demander à l'école de décrire son
 * en-tête par écrit ne marche pas : c'est précisément ce qu'elle n'arrive pas à
 * lire. Le support reçoit le classeur tel quel, remet les colonnes en forme et
 * le renvoie — l'école le redépose elle-même, ce qui garde l'écriture sous le
 * compte qui en répond.
 */

export interface ResultatSignalement {
  ok: boolean;
  message: string;
}

const schema = z.object({
  // Ce qui manque et ce qui a été trouvé, déjà mis en forme par
  // `resumeEntetesPourSupport` : le même texte que l'écran affiche, pour que
  // le support lise exactement ce que l'utilisateur a vu.
  resume: z.string().trim().min(1).max(3000),
  domaine: z.enum(['eleves', 'enseignants', 'paiements']),
});

const LIBELLE_DOMAINE: Record<'eleves' | 'enseignants' | 'paiements', string> = {
  eleves: 'des élèves',
  enseignants: 'des enseignants',
  paiements: 'des paiements',
};

export async function signalerEntetesAuSupport(
  formData: FormData,
): Promise<ResultatSignalement> {
  const valide = schema.safeParse({
    resume: formData.get('resume'),
    domaine: formData.get('domaine'),
  });
  if (!valide.success) {
    return { ok: false, message: 'Signalement incomplet.' };
  }

  const fichier = formData.get('fichier');
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: 'Le fichier n’a pas pu être joint. Redéposez-le puis réessayez.' };
  }
  if (fichier.size > TAILLE_MAX_PIECE_JOINTE) {
    return { ok: false, message: 'Fichier trop volumineux (10 Mo maximum).' };
  }

  const domaine = valide.data.domaine;

  try {
    const contenu = await fichier.arrayBuffer();
    await creerDemandeSupport(
      {
        categorie: 'AUTRE',
        sujet: `Colonnes non reconnues — import ${LIBELLE_DOMAINE[domaine]}`,
        message: [
          `Le fichier d'import ${LIBELLE_DOMAINE[domaine]} n'a pas pu être lu : ses colonnes ne correspondent pas au gabarit attendu.`,
          '',
          valide.data.resume,
          '',
          'Le fichier est joint à cette demande.',
        ].join('\n'),
        pageOrigine: `/etablissement/${domaine}/import`,
      },
      {
        nom: fichier.name,
        type: fichier.type || 'application/octet-stream',
        contenu,
      },
    );

    return {
      ok: true,
      message:
        'Fichier transmis au support. Vous recevrez la réponse sur votre page Support, avec le fichier remis en forme.',
    };
  } catch (e) {
    // Les erreurs Supabase ne sont pas des `Error` : lire `message` sur l'objet.
    if (e instanceof Error) return { ok: false, message: e.message };
    if (typeof e === 'object' && e !== null) {
      const m = (e as { message?: unknown }).message;
      if (typeof m === 'string' && m.trim() !== '') return { ok: false, message: m };
    }
    return { ok: false, message: 'Envoi impossible. Vérifiez votre connexion puis réessayez.' };
  }
}
