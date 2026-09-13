import { annoncesDuRendu } from './annonces-du-rendu';
import { CarteAnnonce } from './CarteAnnonce';

/**
 * Les annonces de la plateforme dans la barre latérale, à partir de `md`.
 *
 * Composant **serveur**, passé en créneau à `Sidebar` — qui est un composant
 * client et ne peut donc rien lire en base. C'est le motif habituel : le
 * serveur rend le sous-arbre, le client se contente de lui donner sa place.
 * Le faire autrement — passer les annonces en props depuis chaque page —
 * aurait touché une quarantaine de fichiers, et la première page oubliée
 * aurait perdu ses annonces sans que rien ne le signale.
 *
 * Le créneau est rendu à sa position dans l'arbre, donc **sous**
 * `SidebarCollapseProvider` : la carte peut lire l'état replié et se réduire à
 * sa pastille sur le rail.
 */
export async function AnnoncesSidebar() {
  const annonces = await annoncesDuRendu();
  if (annonces.length === 0) return null;

  return <CarteAnnonce annonces={annonces} variante="sidebar" />;
}
