'use client';

import { useState } from 'react';
import { FolderDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { construireZip, nomFichierSur } from '@/lib/zip';
import { urlsBulletinsClasseAction, type FichierBulletin } from './actions';

/**
 * Téléchargement de tous les bulletins en vigueur d'une classe.
 *
 * **Un dossier, pas une archive, quand le navigateur le permet.** Chrome et
 * Edge sur ordinateur exposent `showDirectoryPicker` : l'utilisateur choisit
 * un dossier et les PDF y sont écrits un par un, prêts à imprimer. Demander à
 * une secrétaire de dézipper avant d'imprimer une pile de bulletins, c'est
 * ajouter une étape que beaucoup ne savent pas faire.
 *
 * Firefox, Safari et les navigateurs mobiles n'ont pas cette API, et aucune
 * page web n'y a le droit d'écrire un dossier. Le repli est une archive ZIP —
 * pas un choix esthétique, une limite du navigateur.
 */

interface PoigneeFichier {
  createWritable(): Promise<{ write(donnees: Uint8Array): Promise<void>; close(): Promise<void> }>;
}
interface PoigneeDossier {
  getFileHandle(nom: string, options?: { create?: boolean }): Promise<PoigneeFichier>;
}
type FenetreAvecSelecteur = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<PoigneeDossier>;
};

export function TelechargerTout({
  classeId,
  periode,
  anneeScolaireId,
  nombreEdites,
  libelleClasse,
}: {
  classeId: string;
  periode: string;
  anneeScolaireId: string;
  nombreEdites: number;
  libelleClasse: string;
}) {
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selecteurDisponible =
    typeof window !== 'undefined' &&
    typeof (window as FenetreAvecSelecteur).showDirectoryPicker === 'function';

  async function telechargerTout() {
    setMessage(null);

    // Le sélecteur de dossier doit être ouvert DANS le geste de l'utilisateur,
    // avant tout `await` sur le réseau : demandé après, le navigateur le refuse
    // au motif qu'il n'y a plus d'interaction en cours.
    let dossier: PoigneeDossier | null = null;
    if (selecteurDisponible) {
      try {
        dossier =
          (await (window as FenetreAvecSelecteur).showDirectoryPicker!({ mode: 'readwrite' })) ??
          null;
      } catch {
        // L'utilisateur a fermé le sélecteur : ce n'est pas une erreur.
        return;
      }
    }

    setEnCours(true);
    try {
      const resultat = await urlsBulletinsClasseAction(classeId, periode, anneeScolaireId);
      if (!resultat) {
        setMessage('La préparation a expiré. Réessayez.');
        return;
      }
      if (resultat.error) {
        setMessage(resultat.error);
        return;
      }
      if (resultat.fichiers.length === 0) {
        setMessage('Aucun bulletin édité pour cette classe et ce trimestre.');
        return;
      }

      const contenus = await telechargerContenus(resultat.fichiers);

      if (dossier) {
        for (const fichier of contenus) {
          const poignee = await dossier.getFileHandle(nomFichierSur(fichier.nomFichier), {
            create: true,
          });
          const flux = await poignee.createWritable();
          await flux.write(fichier.contenu);
          await flux.close();
        }
        setMessage(`${contenus.length} bulletin(s) enregistré(s) dans le dossier choisi.`);
        return;
      }

      const zip = construireZip(
        contenus.map((f) => ({ nom: f.nomFichier, contenu: f.contenu })),
      );
      // `Uint8Array` -> `BlobPart` : la copie évite un `SharedArrayBuffer`
      // hypothétique, que le constructeur de Blob refuse.
      const blob = new Blob([zip.slice()], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = nomFichierSur(`Bulletins ${libelleClasse}.zip`);
      lien.click();
      URL.revokeObjectURL(url);
      setMessage(
        `${contenus.length} bulletin(s) réunis dans une archive. Votre navigateur ne permet pas d'écrire directement dans un dossier.`,
      );
    } catch {
      setMessage('Le téléchargement groupé a échoué. Réessayez.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 md:items-end">
      <Button
        size="sm"
        onClick={telechargerTout}
        disabled={enCours || nombreEdites === 0}
        className="w-full md:w-auto"
      >
        {enCours ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <FolderDown className="h-4 w-4" aria-hidden />
        )}
        {selecteurDisponible ? 'Télécharger tout dans un dossier' : 'Télécharger tout'}
      </Button>
      {message && <p className="text-body-sm text-text-secondary">{message}</p>}
    </div>
  );
}

async function telechargerContenus(
  fichiers: FichierBulletin[],
): Promise<{ nomFichier: string; contenu: Uint8Array }[]> {
  const contenus: { nomFichier: string; contenu: Uint8Array }[] = [];
  // Séquentiel et non parallèle : sur une connexion d'école, vingt requêtes
  // simultanées vers le stockage se gênent plus qu'elles ne s'aident.
  for (const fichier of fichiers) {
    const reponse = await fetch(fichier.url);
    if (!reponse.ok) throw new Error(`Téléchargement refusé (${reponse.status})`);
    contenus.push({
      nomFichier: fichier.nomFichier,
      contenu: new Uint8Array(await reponse.arrayBuffer()),
    });
  }
  return contenus;
}
