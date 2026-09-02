import { Inbox, Loader, CheckCircle2, Clock } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listDemandesSupport } from '@/services/support';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { getSidebarItems } from '@/lib/navigation';
import { FileSupport } from './FileSupport';

export const metadata = { title: 'Support' };

const JOUR = 86_400_000;

/**
 * File de support de la plateforme.
 *
 * Les quatre chiffres du haut ne sont pas là pour décorer : ils répondent aux
 * seules questions qu'on se pose en ouvrant cet écran — combien reste-t-il à
 * faire, combien est en cours, est-ce qu'on avance, et surtout **depuis
 * combien de temps la plus ancienne attend**. Ce dernier est le seul qui
 * alerte : une moyenne rassure toujours, alors qu'une école qui attend depuis
 * six jours est en train de perdre confiance, même si les vingt autres ont eu
 * une réponse dans l'heure.
 *
 * Les statistiques sont calculées ici, sur la liste déjà chargée : une requête
 * d'agrégation supplémentaire coûterait un aller-retour pour un volume qui se
 * compte en dizaines, et ferait diverger les chiffres de la liste affichée.
 *
 * La console **compte et répond, elle ne consulte pas** : rien ici ne lit la
 * donnée d'une école. Ce qui s'affiche est ce que l'école a elle-même écrit.
 */
export default async function SupportPlateformePage() {
  const ctx = await getTenantContext();
  const demandes = await listDemandesSupport();

  const maintenant = Date.now();
  const aTraiter = demandes.filter((d) => d.statut === 'NOUVELLE');
  const enCours = demandes.filter((d) => d.statut === 'EN_COURS');
  const resoluesRecentes = demandes.filter(
    (d) =>
      d.statut === 'RESOLUE' &&
      d.repondueLe !== null &&
      maintenant - new Date(d.repondueLe).getTime() < 30 * JOUR,
  );

  const attentes = aTraiter.map((d) =>
    Math.floor((maintenant - new Date(d.createdAt).getTime()) / JOUR),
  );
  const plusAncienne = attentes.length > 0 ? Math.max(...attentes) : null;

  const metriques = [
    {
      valeur: String(aTraiter.length),
      libelle: 'à traiter',
      Icone: Inbox,
      classe: 'bg-primary-fixed text-primary-container',
    },
    {
      valeur: String(enCours.length),
      libelle: 'en cours',
      Icone: Loader,
      classe: 'bg-amber-500/10 text-amber-700',
    },
    {
      valeur: String(resoluesRecentes.length),
      libelle: 'résolues sur 30 jours',
      Icone: CheckCircle2,
      classe: 'bg-tertiary/10 text-tertiary',
    },
    {
      valeur:
        plusAncienne === null
          ? '—'
          : plusAncienne === 0
            ? "aujourd'hui"
            : `${plusAncienne} j`,
      libelle: plusAncienne === null ? 'aucune en attente' : 'la plus ancienne en attente',
      Icone: Clock,
      // L'alerte se déclenche à trois jours : au-delà, l'école a eu le temps
      // de conclure que personne ne lui répondra.
      classe:
        plusAncienne !== null && plusAncienne >= 3
          ? 'bg-error/10 text-error'
          : 'bg-surface-container text-text-secondary',
    },
  ];

  return (
    <AppLayout
      items={getSidebarItems('SUPER_ADMIN')}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="Support"
          description={
            aTraiter.length > 0
              ? `${aTraiter.length} demande${aTraiter.length > 1 ? 's' : ''} sans réponse sur ${demandes.length}.`
              : `${demandes.length} demande${demandes.length > 1 ? 's' : ''}, aucune en attente.`
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metriques.map((m) => (
            <div
              key={m.libelle}
              className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface-container-lowest px-4 py-3"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${m.classe}`}
                aria-hidden
              >
                <m.Icone className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-body-md font-semibold text-text-primary">{m.valeur}</p>
                <p className="text-body-sm text-text-secondary">{m.libelle}</p>
              </div>
            </div>
          ))}
        </div>

        <FileSupport demandes={demandes} />
      </div>
    </AppLayout>
  );
}
