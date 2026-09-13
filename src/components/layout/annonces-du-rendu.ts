import { cache } from 'react';
import { listAnnoncesEnCours } from '@/services/annonce';
import type { AnnonceAffichee } from './CarteAnnonce';

/**
 * Les annonces en cours, lues **une seule fois par rendu**.
 *
 * Elles s'affichent à deux endroits qui ne sont pas dans le même sous-arbre :
 * la carte de la barre latérale à partir de `md`, le bandeau en dessous. Deux
 * composants serveur, donc deux appels — et deux requêtes pour une information
 * identique, sur chaque page de l'application.
 *
 * `cache()` de React les ramène à une. Le mémo est **par requête**, pas par
 * processus : une annonce publiée depuis la Régie apparaît au rechargement
 * suivant, comme avant.
 *
 * La gestion de l'échec vit ici plutôt que dans chaque composant : deux
 * `try/catch` finiraient par diverger, et le jour où l'un des deux se
 * tromperait, une école verrait la carte sans le bandeau — ou l'inverse. Une
 * annonce manquante est moins grave qu'une application inaccessible.
 */
export const annoncesDuRendu = cache(async (): Promise<AnnonceAffichee[]> => {
  try {
    const annonces = await listAnnoncesEnCours();
    return annonces.map((annonce) => ({
      id: annonce.id,
      type: annonce.type,
      titre: annonce.titre,
      message: annonce.message,
      finitLeLabel: libelleFin(annonce.finitLe),
    }));
  } catch {
    return [];
  }
});

/**
 * « Jusqu'au 24 septembre », côté serveur.
 *
 * Formaté ici et non dans le composant client : `toLocaleDateString` suit le
 * fuseau de la machine qui l'exécute, et la même date rendue deux fois — une
 * fois au serveur, une fois à l'hydratation — produirait un écart le jour où le
 * produit sortira du Togo. Une chaîne déjà faite ne peut pas diverger.
 *
 * L'année n'apparaît que si elle n'est pas l'année courante : une annonce dure
 * quelques jours, l'écrire chaque fois n'ajoute rien et allonge une ligne qui
 * partage déjà sa place avec le bouton.
 */
function libelleFin(iso: string): string {
  const fin = new Date(iso);
  if (Number.isNaN(fin.getTime())) return '';

  const maintenant = new Date();
  const memeJour =
    fin.getFullYear() === maintenant.getFullYear() &&
    fin.getMonth() === maintenant.getMonth() &&
    fin.getDate() === maintenant.getDate();

  // Une annonce qui se termine aujourd'hui se dit par son échéance, pas par sa
  // date : « jusqu'au 13 septembre » un 13 septembre se lit comme une date
  // passée.
  if (memeJour) return "Se termine aujourd'hui";

  return `Jusqu'au ${fin.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    ...(fin.getFullYear() === maintenant.getFullYear() ? {} : { year: 'numeric' }),
  })}`;
}
