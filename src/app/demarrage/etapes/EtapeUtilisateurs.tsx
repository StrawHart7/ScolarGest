'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErreurEtape, PuceChoix } from '../Bulles';
import { inviterUtilisateursAction } from '../actions';

interface Ligne {
  nom: string;
  prenom: string;
  email: string;
  role: 'SECRETAIRE' | 'COMPTABLE';
}

const LIGNE_VIDE: Ligne = { nom: '', prenom: '', email: '', role: 'SECRETAIRE' };

const LIBELLE_ROLE: Record<Ligne['role'], string> = {
  SECRETAIRE: 'Secrétaire',
  COMPTABLE: 'Comptable',
};

/**
 * Seuls SECRETAIRE et COMPTABLE sont proposés : `inviteUtilisateur` réserve
 * l'invitation d'un DIRECTEUR au SUPER_ADMIN.
 *
 * C'est aussi l'étape qui débloque la suite côté finance — les frais et les
 * tarifs exigent l'un de ces deux rôles, le Directeur étant en lecture seule
 * sur la finance (Docs/08 § 17). La personne invitée trouvera son propre
 * questionnaire à sa première connexion.
 */
export function EtapeUtilisateurs({
  etablissementId,
  onTermine,
}: {
  etablissementId: string;
  onTermine: () => void;
}) {
  const [lignes, setLignes] = React.useState<Ligne[]>([{ ...LIGNE_VIDE }]);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  function modifier(index: number, champ: keyof Ligne, valeur: string) {
    setLignes((prec) =>
      prec.map((ligne, i) => (i === index ? { ...ligne, [champ]: valeur } : ligne)),
    );
  }

  const completes = lignes.filter((l) => l.nom.trim() && l.prenom.trim() && l.email.trim());

  async function valider() {
    setErreur(null);
    setEnCours(true);
    const resultat = await inviterUtilisateursAction({
      etablissementId,
      utilisateurs: completes,
    });
    setEnCours(false);
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    onTermine();
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      {lignes.map((ligne, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <Input
            value={ligne.nom}
            onChange={(e) => modifier(index, 'nom', e.target.value)}
            placeholder="Nom"
            aria-label={`Nom de la personne ${index + 1}`}
            className="h-9 w-32"
          />
          <Input
            value={ligne.prenom}
            onChange={(e) => modifier(index, 'prenom', e.target.value)}
            placeholder="Prénom"
            aria-label={`Prénom de la personne ${index + 1}`}
            className="h-9 w-32"
          />
          <Input
            type="email"
            value={ligne.email}
            onChange={(e) => modifier(index, 'email', e.target.value)}
            placeholder="email@ecole.tg"
            aria-label={`Email de la personne ${index + 1}`}
            className="h-9 min-w-[11rem] flex-1"
          />
          <div role="group" aria-label={`Rôle de la personne ${index + 1}`} className="flex gap-1">
            {(['SECRETAIRE', 'COMPTABLE'] as const).map((role) => (
              <PuceChoix
                key={role}
                selectionne={ligne.role === role}
                onClick={() => modifier(index, 'role', role)}
              >
                {LIBELLE_ROLE[role]}
              </PuceChoix>
            ))}
          </div>
          {lignes.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Retirer la personne ${index + 1}`}
              onClick={() => setLignes((prec) => prec.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
      ))}

      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setLignes((prec) => [...prec, { ...LIGNE_VIDE }])}
          className="gap-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter une personne
        </Button>
      </div>

      <ErreurEtape message={erreur} />
      <div className="flex justify-end">
        <Button onClick={valider} disabled={enCours || completes.length === 0}>
          {enCours ? 'Envoi…' : `Envoyer ${completes.length} invitation${completes.length > 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}
