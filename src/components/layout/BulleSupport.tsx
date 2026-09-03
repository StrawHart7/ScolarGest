'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Headset } from 'lucide-react';

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
    <div className="fixed bottom-6 right-6 z-30 hidden md:block">
      {/*
        Bouton rond plein plutôt que la pilule discrète d'avant : à cette
        taille et avec un casque d'assistance, il se lit sans avoir à le
        survoler. L'ancienne version reposait sur un libellé qui n'apparaissait
        qu'au survol — donc sur le fait de survoler par hasard un objet dont
        rien ne disait ce qu'il faisait.
      */}
      <Link
        href={href}
        aria-label="Contacter le support"
        className="group relative grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-primary-container to-primary text-white shadow-[0_10px_28px_-6px_rgba(0,61,155,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-8px_rgba(0,61,155,0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/50 focus-visible:ring-offset-2 active:scale-95"
      >
        {/* Halo qui bat lentement : attire l'œil une fois, sans clignoter. */}
        <span
          aria-hidden
          className="animate-ring-pulse absolute inset-0 rounded-full bg-primary-container"
        />
        <Headset className="relative h-6 w-6" aria-hidden />

        {/*
          Le libellé reste au survol, mais il n'est plus le seul indice : c'est
          une confirmation, pas la découverte. Transition sur la largeur, pas
          sur l'opacité, pour que rien ne clignote au passage de la souris.
        */}
        <span className="pointer-events-none absolute right-full mr-3 max-w-0 overflow-hidden whitespace-nowrap rounded-full bg-text-primary px-0 py-2 text-body-sm font-medium text-white opacity-0 shadow-floating transition-[max-width,opacity,padding] duration-200 group-hover:max-w-[12rem] group-hover:px-3.5 group-hover:opacity-100">
          Contacter le support
        </span>
      </Link>
    </div>
  );
}
