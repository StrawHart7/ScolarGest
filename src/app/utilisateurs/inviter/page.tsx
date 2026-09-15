'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { IdentifiantsRemis } from '@/components/ui/identifiants-remis';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LienRetour } from '@/components/layout/LienRetour';
import { cn } from '@/lib/utils';
import { normaliserIdentifiant, proposerIdentifiant } from '@/lib/identifiants';
import { inviterUtilisateur } from '../actions';

/**
 * Deux façons d'ouvrir un compte, sur un seul écran.
 *
 * L'email reste proposé en premier : c'est le chemin autonome, l'invité choisit
 * son mot de passe et pourra le réinitialiser seul. L'identifiant est le chemin
 * qui manquait — une bonne partie des enseignants togolais n'a pas d'adresse
 * email, ou en a une qu'elle ne consulte jamais, et le compte n'était donc
 * jamais activé.
 *
 * **Le mot de passe s'affiche une fois et ne revient pas.** Le relire exigerait
 * de le garder en clair. Ce n'est pas un oubli de confort : c'est pour ça que
 * l'écran insiste pour qu'on le note avant de quitter la page, et que la
 * réinitialisation existe.
 */

function BoutonEnvoyer({ mode }: { mode: Mode }) {
  const { pending } = useFormStatus();
  const libelle = mode === 'EMAIL' ? "Envoyer l'invitation" : 'Créer le compte';
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Un instant...' : libelle}
    </Button>
  );
}

type Mode = 'EMAIL' | 'IDENTIFIANT';

export default function InviterUtilisateurPage() {
  const [resultat, formAction] = useFormState(inviterUtilisateur, null);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('EMAIL');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [identifiant, setIdentifiant] = useState('');
  const [identifiantTouche, setIdentifiantTouche] = useState(false);
  const [ecranResultatMasque, setEcranResultatMasque] = useState(false);

  const suggestion = proposerIdentifiant(nom, prenom);
  const valeurIdentifiant = identifiantTouche ? identifiant : suggestion;

  /**
   * Remet l'écran en état de saisie après une création.
   *
   * `router.refresh()` ne suffirait pas : il refait le rendu serveur, mais
   * l'état d'un `useFormState` est **client** et survit — la page serait restée
   * sur l'écran de succès, avec les mêmes identifiants affichés. D'où ce
   * drapeau, et le nettoyage explicite des champs contrôlés.
   */
  const recommencer = () => {
    setEcranResultatMasque(true);
    setNom('');
    setPrenom('');
    setIdentifiant('');
    setIdentifiantTouche(false);
  };

  if (resultat?.etat === 'CREE' && !ecranResultatMasque) {
    return (
      <main className="mx-auto max-w-xl px-gutter py-gutter sm:p-container-pad">
        <h1 className="mb-6 text-display-sm text-text-primary">Le compte est prêt</h1>

        <IdentifiantsRemis
          identifiant={resultat.identifiant}
          motDePasse={resultat.motDePasse}
          destinataire={resultat.nomComplet}
          actions={({ confirmer }) => (
            <>
              <Button type="button" onClick={() => confirmer(() => router.push('/utilisateurs'))}>
                Retour aux utilisateurs
              </Button>
              <Button type="button" variant="secondary" onClick={() => confirmer(recommencer)}>
                Créer un autre compte
              </Button>
            </>
          )}
        />

        <p className="mt-4 text-body-sm text-text-secondary">
          Cette personne devra choisir son propre mot de passe à sa première connexion.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-gutter py-gutter sm:p-container-pad">
      <LienRetour href="/utilisateurs" className="mb-4">
        Retour aux utilisateurs
      </LienRetour>
      <h1 className="mb-6 text-display-sm text-text-primary">Ajouter un membre de l&apos;équipe</h1>

      {/*
        Le drapeau est relevé à chaque soumission : sans cela, le second compte
        créé n'afficherait **jamais** son mot de passe — l'écran resterait masqué
        par la remise à zéro du précédent, et personne ne saurait pourquoi.
      */}
      <form
        action={(donnees) => {
          setEcranResultatMasque(false);
          formAction(donnees);
        }}
        className="flex flex-col gap-6"
      >
        <input type="hidden" name="mode" value={mode} />

        <Card>
          <CardHeader>
            <CardTitle>Comment cette personne se connectera</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ChoixMode
                actif={mode === 'EMAIL'}
                onClick={() => setMode('EMAIL')}
                titre="Avec une adresse email"
                detail="Elle reçoit un lien et choisit son mot de passe."
              />
              <ChoixMode
                actif={mode === 'IDENTIFIANT'}
                onClick={() => setMode('IDENTIFIANT')}
                titre="Avec un identifiant"
                detail="Vous lui remettez un mot de passe. Aucune adresse email nécessaire."
              />
            </div>

            {mode === 'IDENTIFIANT' ? (
              <p className="text-body-sm text-text-secondary">
                À retenir : sans adresse email, cette personne ne pourra pas récupérer son mot de
                passe toute seule. C&apos;est vous qui lui en redonnerez un.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Détails</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prenom">Prénom</Label>
                <Input
                  id="prenom"
                  name="prenom"
                  required
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nom">Nom</Label>
                <Input
                  id="nom"
                  name="nom"
                  required
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                />
              </div>
            </div>

            {mode === 'EMAIL' ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="identifiant">Identifiant</Label>
                <Input
                  id="identifiant"
                  name="identifiant"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={valeurIdentifiant}
                  onChange={(e) => {
                    setIdentifiantTouche(true);
                    setIdentifiant(normaliserIdentifiant(e.target.value));
                  }}
                />
                <p className="text-body-sm text-text-secondary">
                  C&apos;est ce qu&apos;elle tapera à la place de l&apos;adresse email. Proposé
                  d&apos;après le nom, modifiable.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">Rôle</Label>
              <Select name="role" required defaultValue="SECRETAIRE">
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SECRETAIRE">Secrétaire</SelectItem>
                  <SelectItem value="COMPTABLE">Comptable</SelectItem>
                  <SelectItem value="ENSEIGNANT">Enseignant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {resultat?.etat === 'ERREUR' && (
          <p className="text-body-sm text-error">{resultat.message}</p>
        )}
        <BoutonEnvoyer mode={mode} />
      </form>
    </main>
  );
}

function ChoixMode({
  actif,
  onClick,
  titre,
  detail,
}: {
  actif: boolean;
  onClick: () => void;
  titre: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cn(
        'flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors',
        actif
          ? 'border-primary-container bg-primary-container/10'
          : 'border-surface-border hover:bg-surface-container',
      )}
    >
      <span className="text-body-md font-semibold text-text-primary">{titre}</span>
      <span className="text-body-sm text-text-secondary">{detail}</span>
    </button>
  );
}
