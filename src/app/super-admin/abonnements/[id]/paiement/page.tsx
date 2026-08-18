import { Wallet } from 'lucide-react';
import { PaiementForm } from './PaiementForm';

export default function ValiderPaiementPage({ params }: { params: { id: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-gutter">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-xl border border-surface-border bg-surface-container-lowest p-container-pad shadow-floating">
        <header className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tertiary/10 text-tertiary">
            <Wallet className="h-7 w-7" aria-hidden />
          </div>
          <div>
            <h1 className="text-display-sm text-text-primary">Valider un paiement</h1>
            <p className="mt-1 text-body-md text-text-secondary">
              Enregistre un paiement confirmé hors plateforme et réactive l&apos;abonnement.
            </p>
          </div>
        </header>

        <PaiementForm abonnementId={params.id} />
      </div>
    </main>
  );
}
