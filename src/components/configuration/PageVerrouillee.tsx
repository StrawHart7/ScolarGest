import { getTenantContext } from '@/services/tenant';
import { getSidebarItems } from '@/lib/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { PageHeader } from '@/components/layout/PageHeader';
import { DomaineVerrouille } from './DomaineVerrouille';
import type { Domaine, Prerequis } from '@/lib/configuration-domaines';

/**
 * La page entière d'une section qu'on ne peut pas encore utiliser.
 *
 * Elle existe pour que l'appelant tienne en trois lignes. Huit écrans posent ce
 * verrou ; huit copies d'une quinzaine de lignes de mise en page auraient
 * divergé au premier ajustement — c'est déjà arrivé ici sur la table des
 * icônes de navigation, qui vivait en double et dont les deux copies
 * s'étaient éloignées.
 *
 * **Le retour et l'en-tête restent** : on n'est pas sur un écran d'erreur, on
 * est sur la page demandée, qui explique ce qui lui manque. Retirer la
 * navigation donnerait le sentiment d'avoir été éjecté.
 */
export async function PageVerrouillee({
  domaine,
  titre,
  description,
  retour,
  manques,
}: {
  domaine: Domaine;
  titre: string;
  description?: string;
  retour?: { href: string; libelle: string };
  manques: Prerequis[];
}) {
  const ctx = await getTenantContext();

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-4 md:space-y-6">
        {retour ? <LienRetour href={retour.href}>{retour.libelle}</LienRetour> : null}

        <div className="hidden md:block">
          <PageHeader title={titre} description={description} />
        </div>

        <DomaineVerrouille domaine={domaine} manques={manques} role={ctx.role} />
      </div>
    </AppLayout>
  );
}
