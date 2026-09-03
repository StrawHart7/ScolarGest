import {
  BookOpenCheck,
  ChartColumn,
  CircleHelp,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  Presentation,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { NomIcone } from '@/lib/navigation';

/**
 * Icone de chaque entree de navigation.
 *
 * Cette table vivait en double — une copie dans `Sidebar.tsx` (client), une
 * dans `SectionAccueil.tsx` (serveur) — et les deux avaient deja diverge.
 * Elle est donc sortie dans un module sans `'use client'`, importable des deux
 * cotes : c'est le seul moyen qu'une icone ajoutee ici apparaisse partout.
 *
 * Une entree par nom : `Record<NomIcone, …>` fait echouer la compilation si un
 * nom d'icone est ajoute au type sans etre renseigne ici.
 *
 * Rapports, Statistiques et Journal d'audit ont partage la meme icone.
 * Indistinguables des que la sidebar est repliee — il n'y reste que l'icone.
 */
export const ICONES: Record<NomIcone, LucideIcon> = {
  'tableau-de-bord': LayoutDashboard,
  eleves: GraduationCap,
  enseignants: UsersRound,
  notes: BookOpenCheck,
  finances: Wallet,
  etablissement: ShieldCheck,
  rapports: Presentation,
  statistiques: ChartColumn,
  journal: ScrollText,
  'mes-classes': Users,
  abonnements: CreditCard,
  utilisateurs: Users,
  parametres: Settings,
  aide: CircleHelp,
  support: LifeBuoy,
};
