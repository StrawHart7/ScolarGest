import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { AppLayout } from '@/components/layout/AppLayout';
import { getSidebarItems, SECTIONS } from '@/lib/navigation';
import type { Role } from '@/services/tenant';

interface Rubrique {
  question: string;
  reponse: string;
  roles: Role[];
}

const TOUS: Role[] = ['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT'];

const RUBRIQUES: Rubrique[] = [
  {
    question: 'À quoi sert le PIN de confirmation ?',
    reponse:
      "Il protège les actions irréversibles : approbation d'une note, activation d'une année scolaire, verrouillage d'un cycle. Vous le définissez dans Paramètres. Sans PIN configuré, ces actions restent bloquées.",
    roles: ['DIRECTEUR', 'SECRETAIRE'],
  },
  {
    question: 'Pourquoi ne puis-je pas modifier un tarif déjà appliqué ?',
    reponse:
      "Les tarifs sont rattachés à une année scolaire et ne sont jamais modifiés après coup : une facture déjà émise doit rester conforme à ce qui a été facturé. Pour changer un montant, créez un tarif sur la nouvelle année.",
    roles: ['DIRECTEUR', 'COMPTABLE'],
  },
  {
    question: 'Pourquoi ne puis-je plus modifier les lignes d’une facture ?',
    reponse:
      "Dès qu'un premier versement est encaissé, les lignes sont figées. Cela évite qu'une facture change de montant après un paiement. Si la facture est erronée, il faut l'annuler et en émettre une nouvelle.",
    roles: ['DIRECTEUR', 'COMPTABLE'],
  },
  {
    question: 'Que se passe-t-il quand mon abonnement expire ?',
    reponse:
      "La plateforme passe en lecture seule : vous conservez l'accès à toutes vos données et à vos exports, mais les écritures sont suspendues jusqu'au renouvellement. Vos données ne sont jamais retenues.",
    roles: ['DIRECTEUR'],
  },
  {
    question: 'J’ai soumis des notes, que se passe-t-il ensuite ?',
    reponse:
      "Une note soumise part en file d'approbation. La Secrétaire la valide ou la rejette, avec son PIN. Tant qu'elle n'est pas validée, elle n'entre pas dans les moyennes ni dans les bulletins.",
    roles: ['ENSEIGNANT'],
  },
  {
    question: 'Une note en brouillon compte-t-elle dans la moyenne ?',
    reponse:
      "Non. Une note en brouillon n'est pas officielle : elle est ignorée par le calcul des moyennes, des classements et des bulletins, exactement comme une note absente.",
    roles: TOUS,
  },
  {
    question: 'Comment retrouver rapidement un élève ?',
    reponse:
      'Utilisez la barre de recherche du bandeau supérieur (raccourci Ctrl + K). Elle cherche parmi les élèves, les classes et les enseignants de votre établissement.',
    roles: TOUS,
  },
];

export default async function AidePage() {
  const ctx = await getTenantContext();
  const rubriques = RUBRIQUES.filter((rubrique) => rubrique.roles.includes(ctx.role));
  const sections = Object.entries(SECTIONS);

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-display-sm text-text-primary">Aide</h1>
          <p className="text-body-sm text-text-secondary">
            Réponses aux questions les plus fréquentes pour votre rôle ({ctx.role}).
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-headline-sm text-text-primary">Questions fréquentes</h2>
          <div className="divide-y divide-surface-border overflow-hidden rounded-lg border border-surface-border bg-surface-container-lowest">
            {rubriques.map((rubrique) => (
              <details key={rubrique.question} className="group px-5 py-4">
                <summary className="cursor-pointer list-none text-body-md font-medium text-text-primary transition-colors hover:text-primary-container">
                  {rubrique.question}
                </summary>
                <p className="mt-2 text-body-sm text-text-secondary">{rubrique.reponse}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-surface-border bg-surface-container-lowest px-5 py-4">
          <h2 className="text-headline-sm text-text-primary">Votre question n&apos;est pas ici ?</h2>
          <p className="mt-1 text-body-sm text-text-secondary">
            Écrivez à l&apos;équipe ScolarGest : la réponse s&apos;affichera sur cette même page,
            visible par votre établissement.
          </p>
          <Link
            href="/profil/support"
            className="mt-3 inline-flex items-center gap-1.5 text-body-sm font-medium text-primary-container hover:underline"
          >
            <LifeBuoy className="h-4 w-4" aria-hidden />
            Contacter le support
          </Link>
        </section>

        <section className="space-y-3">
          <h2 className="text-headline-sm text-text-primary">Comment la navigation est organisée</h2>
          <p className="text-body-sm text-text-secondary">
            Chaque entrée de la barre latérale regroupe plusieurs écrans. Cliquez dessus pour voir
            la liste complète de ses fonctionnalités.
          </p>
          <ul className="space-y-2">
            {sections.map(([chemin, section]) => (
              <li
                key={chemin}
                className="rounded-lg border border-surface-border bg-surface-container-lowest px-5 py-3"
              >
                <p className="text-body-md text-text-primary">{section.titre}</p>
                <p className="text-body-sm text-text-secondary">{section.description}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppLayout>
  );
}
