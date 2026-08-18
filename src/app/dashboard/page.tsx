import { getTenantContext } from '@/services/tenant';
import { requireRole } from '@/services/authorization';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { triggerTestAuditLog } from './actions';

const SIDEBAR_ITEMS = [{ label: 'Tableau de bord', href: '/dashboard' }];

async function SuperAdminOnlySection() {
  try {
    await requireRole(); // aucun rôle listé => seul SUPER_ADMIN passe
  } catch (e) {
    return (
      <Card className="max-w-lg p-6">
        <h2 className="text-display-sm mb-2 text-text-primary">
          Section réservée SUPER_ADMIN (test requireRole)
        </h2>
        <p className="text-body-sm text-error">
          {e instanceof Error ? e.message : 'Accès refusé'}
        </p>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg p-6">
      <h2 className="text-display-sm mb-2 text-text-primary">
        Section réservée SUPER_ADMIN (test requireRole)
      </h2>
      <p className="text-body-sm text-text-secondary">
        Tu vois ce bloc parce que requireRole() t&apos;a laissé passer.
      </p>
    </Card>
  );
}

export default async function DashboardPage() {
  let ctx;
  try {
    ctx = await getTenantContext();
  } catch (e) {
    return (
      <main className="p-8">
        <Card className="max-w-lg p-6">
          <h1 className="text-display-sm mb-2 text-text-primary">Contexte tenant (debug)</h1>
          <p className="text-body-sm text-error">
            {e instanceof Error ? e.message : 'Erreur inconnue'}
          </p>
        </Card>
      </main>
    );
  }

  const supabase = createClient();
  const { data: recentLogs } = await supabase
    .from('audit_log')
    .select('id, action, module, "etablissementId", "userId", date')
    .order('date', { ascending: false })
    .limit(5);

  return (
    <AppLayout items={SIDEBAR_ITEMS} schoolName="ScolarGest" role={ctx.role} userName={ctx.email}>
      <div className="space-y-6">
      <Card className="max-w-lg p-6">
        <h1 className="text-display-sm mb-4 text-text-primary">Contexte tenant (debug)</h1>
        <dl className="space-y-2 text-body-sm text-text-secondary">
          <div>
            <dt className="font-medium text-text-primary">userId</dt>
            <dd>{ctx.userId}</dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">email</dt>
            <dd>{ctx.email}</dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">role</dt>
            <dd>{ctx.role}</dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">etablissementId</dt>
            <dd>{ctx.etablissementId || '(aucun — SUPER_ADMIN)'}</dd>
          </div>
        </dl>
      </Card>

      <Card className="max-w-lg p-6">
        <h2 className="text-display-sm mb-4 text-text-primary">Test audit log</h2>
        <form action={triggerTestAuditLog}>
          <Button type="submit">Déclencher un événement d&apos;audit</Button>
        </form>

        <div className="mt-6">
          <h3 className="mb-2 text-body-sm font-medium text-text-primary">
            5 dernières entrées visibles (RLS)
          </h3>
          {!recentLogs || recentLogs.length === 0 ? (
            <p className="text-body-sm text-text-secondary">Aucune entrée.</p>
          ) : (
            <ul className="space-y-2 text-body-sm text-text-secondary">
              {recentLogs.map((log) => (
                <li key={log.id} className="border-b border-surface-border pb-2">
                  <span className="font-medium text-text-primary">{log.action}</span> ·{' '}
                  {log.module} · {new Date(log.date).toLocaleString()}
                  <br />
                  etablissementId: {log.etablissementId ?? 'null'} · userId: {log.userId}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

        <SuperAdminOnlySection />
      </div>
    </AppLayout>
  );
}
