import { getTenantContext } from '@/services/tenant';
import { listCycles, listCyclesActifs } from '@/services/structure';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSidebarItems } from '@/lib/navigation';
import { ActiverCycleButton } from './ActiverCycleButton';

export default async function CyclesPage() {
  const ctx = await getTenantContext();
  const [cycles, cyclesActifs] = await Promise.all([listCycles(), listCyclesActifs()]);
  const actifsIds = new Set(cyclesActifs.map((c) => c.cycleId));

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <LienRetour href="/etablissement">Retour à l&apos;établissement</LienRetour>

        <div>
          <h1 className="text-display-sm text-text-primary">Cycles</h1>
          <p className="text-body-md text-text-secondary">
            Activez les cycles d&apos;enseignement proposés par votre établissement.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cycles disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-surface-border">
              {cycles.map((cycle) => {
                const actif = actifsIds.has(cycle.id);
                return (
                  <li key={cycle.id} className="flex items-center justify-between py-3">
                    <span className="text-body-md font-medium text-text-primary">{cycle.nom}</span>
                    {actif ? (
                      <Badge variant="success">Activé</Badge>
                    ) : ctx.role === 'DIRECTEUR' ? (
                      <ActiverCycleButton cycleId={cycle.id} nom={cycle.nom} />
                    ) : (
                      <Badge variant="neutral">Inactif</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
