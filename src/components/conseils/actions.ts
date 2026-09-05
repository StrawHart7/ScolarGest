'use server';

import {
  getConseilDuMoment,
  marquerConseilVu,
  reporterConseil,
  releguerConseil,
  suivreConseil,
} from '@/services/conseils';

/**
 * Actions du panneau de conseils.
 *
 * Placées ici plutôt que sous `src/app/` — contrairement à la convention du
 * dépôt — parce que le panneau n'appartient à aucune page : il est monté dans
 * le layout et vit sur tous les écrans. Le rattacher arbitrairement à
 * `/dashboard` laisserait croire qu'il en dépend.
 *
 * Elles sont **volontairement silencieuses**. Un conseil est un service rendu,
 * jamais une opération dont l'échec doit interrompre ce que l'utilisateur est
 * en train de faire : si le réseau tombe au moment où il clique « plus tard »,
 * le panneau se ferme quand même et le conseil reviendra. C'est le même parti
 * pris que les brouillons hors ligne, qui avalent leurs erreurs pour ne jamais
 * faire tomber un formulaire.
 */

export interface ConseilAffichable {
  id: string;
  titre: string;
  texte: string;
  actionLabel: string | null;
  actionHref: string | null;
  nouveaute: boolean;
}

/**
 * Le conseil du moment, ou `null`. Appelée depuis le client avec le chemin
 * courant : un layout serveur ne connaît pas l'URL, et la faire remonter par
 * le client évite en prime de faire tourner le diagnostic pendant le rendu de
 * chaque page.
 */
export async function demanderConseil(
  urlCourante: string,
): Promise<ConseilAffichable | null> {
  const choix = await getConseilDuMoment(urlCourante);
  if (!choix) return null;

  // Le compteur d'affichage arme le délai de 24 heures. Il est écrit ici, à
  // l'envoi, et non à la décision de l'utilisateur : quelqu'un qui ignore le
  // panneau sans y toucher ne doit pas en recevoir un autre à la page
  // suivante.
  try {
    await marquerConseilVu(choix.conseil.id);
  } catch {
    // Un conseil affiché deux fois vaut mieux qu'une page en erreur.
  }

  return {
    id: choix.conseil.id,
    titre: choix.conseil.titre,
    texte: choix.texte,
    actionLabel: choix.conseil.action?.label ?? null,
    actionHref: choix.conseil.action?.href ?? null,
    nouveaute: choix.nouveaute,
  };
}

export async function reporterConseilAction(conseilId: string): Promise<void> {
  try {
    await reporterConseil(conseilId);
  } catch {
    /* voir l'en-tête : l'échec ne doit rien interrompre */
  }
}

export async function releguerConseilAction(conseilId: string): Promise<void> {
  try {
    await releguerConseil(conseilId);
  } catch {
    /* voir l'en-tête */
  }
}

export async function suivreConseilAction(conseilId: string): Promise<void> {
  try {
    await suivreConseil(conseilId);
  } catch {
    /* voir l'en-tête */
  }
}
