'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LifeBuoy } from 'lucide-react';

/**
 * Accès flottant au support, en bas à droite.
 *
 * Le support quitte la barre latérale : ce n'est pas une destination qu'on
 * visite, c'est un recours dont on a besoin *pendant* qu'on fait autre chose.
 * Une entrée de menu suppose qu'on la cherche ; une bulle reste là, au même
 * endroit, sur tous les écrans — c'est le geste que tout le monde connaît.
 *
 * **Desktop uniquement.** Sous `md`, ce coin est déjà occupé par le bouton
 * d'action des pages de liste (`bottom-24 right-4`) et surplombé par la barre
 * d'onglets flottante. Un troisième élément flottant y rendrait les deux
 * autres inatteignables. Sur mobile, le support reste accessible par l'onglet
 * « Plus », qui existe exactement pour ça.
 *
 * Réservée aux rôles école : le SUPER_ADMIN ne s'écrit pas à lui-même, il
 * garde sa file dans la barre latérale.
 */
export function BulleSupport({ role }: { role?: string }) {
  const pathname = usePathname();

  if (!role || role === 'SUPER_ADMIN') return null;
  // Inutile de proposer d'aller là où l'on est déjà.
  if (pathname.startsWith('/profil/support')) return null;

  // Le chemin courant part avec la demande : sans lui, une demande sur deux
  // commence par un aller-retour « sur quel écran étiez-vous ? ».
  const href = `/profil/support?depuis=${encodeURIComponent(pathname)}`;

  return (
    <Link
      href={href}
      aria-label="Contacter le support"
      title="Contacter le support"
      className="group fixed bottom-6 right-6 z-30 hidden items-center gap-2 rounded-full bg-primary-container py-3 pl-4 pr-4 text-white shadow-floating transition-[padding,background-color] hover:bg-primary md:flex"
    >
      <LifeBuoy className="h-5 w-5 shrink-0" aria-hidden />
      {/*
        Le libellé n'apparaît qu'au survol : une bulle muette laisse douter de
        ce qu'elle fait, une bulle bavarde encombre en permanence un coin qui
        ne doit pas voler l'attention. La transition porte sur la largeur, pas
        sur l'opacité, pour que rien ne clignote au passage de la souris.
      */}
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-body-sm font-medium opacity-0 transition-[max-width,opacity] duration-200 group-hover:max-w-[10rem] group-hover:opacity-100">
        Contacter le support
      </span>
    </Link>
  );
}
