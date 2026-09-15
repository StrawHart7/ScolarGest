import { redirect } from 'next/navigation';
import { getTenantContext } from '@/services/tenant';

/**
 * « Notes et résultats » ouvre un écran, pas un menu.
 *
 * Lequel dépend du métier de celui qui clique, et c'est tout l'intérêt : un
 * Enseignant vient saisir, un Directeur vient regarder comment s'en sortent ses
 * classes. Les servir tous les deux avec la même grille de cinq blocs, c'était
 * ne répondre à aucun des deux.
 *
 * Les autres écrans de la section sont portés par `BarreSection` en tête de la
 * destination. Rien n'est retiré.
 */
export default async function NotesPage() {
  const ctx = await getTenantContext();
  if (ctx.role === 'ENSEIGNANT') redirect('/etablissement/notes/saisie');
  redirect('/etablissement/notes/resultats');
}
