'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ScolaIllustration } from '@/components/scola/illustration';

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
 * d'onglets. Un troisième élément flottant y rendrait les deux autres
 * inatteignables. Sur mobile, le support reste accessible par l'onglet
 * « Plus », qui existe exactement pour ça.
 *
 * Réservée aux rôles école : le SUPER_ADMIN ne s'écrit pas à lui-même, il
 * garde sa file dans la barre latérale.
 *
 * ## C'est Scola qui attend là, plus un casque d'assistance
 *
 * Le casque disait « service client », ce qui est vrai et froid. La mascotte
 * dit qu'il y a quelqu'un — et comme son regard suit le curseur, elle le dit
 * avant même qu'on la survole.
 *
 * **La bulle passe donc du bleu plein au blanc.** Scola est en
 * `primary-container` (#0052cc) : posée sur l'ancien fond dégradé
 * `primary-container → primary`, elle disparaissait purement et simplement. Le
 * halo qui bat garde la couleur, en transparence, et c'est lui qui accroche
 * l'œil ; le contour reste celui des cartes.
 *
 * Le libellé au survol devient sa phrase. Il ne dit pas « je m'en occupe » —
 * il transmet, il ne répond pas, et une mascotte qui promet plus que le produit
 * ne tient est une mascotte qu'on finit par ne plus croire.
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
      <Link
        href={href}
        aria-label="Contacter le support"
        className="group relative grid h-16 w-16 place-items-center rounded-full border border-surface-border bg-surface-container-lowest shadow-[0_10px_28px_-6px_rgba(0,61,155,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-container/40 hover:shadow-[0_16px_34px_-8px_rgba(0,61,155,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/50 focus-visible:ring-offset-2 active:scale-95"
      >
        {/* Halo qui bat lentement : attire l'œil une fois, sans clignoter. */}
        <span
          aria-hidden
          className="animate-ring-pulse absolute inset-0 rounded-full bg-primary-container/25"
        />

        <span className="relative">
          <ScolaIllustration etat="idle" taille={44} />
        </span>

        {/*
          Le libellé reste au survol, mais il n'est plus le seul indice : c'est
          une confirmation, pas la découverte. Transition sur la largeur, pas
          sur l'opacité, pour que rien ne clignote au passage de la souris.
        */}
        <span className="pointer-events-none absolute right-full mr-3 max-w-0 overflow-hidden whitespace-nowrap rounded-full bg-text-primary px-0 py-2 text-body-sm font-medium text-white opacity-0 shadow-floating transition-[max-width,opacity,padding] duration-200 group-hover:max-w-[16rem] group-hover:px-3.5 group-hover:opacity-100">
          Je transmets au support
        </span>
      </Link>
    </div>
  );
}
