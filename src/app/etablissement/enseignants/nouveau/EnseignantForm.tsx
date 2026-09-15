'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IdentifiantsRemis } from '@/components/ui/identifiants-remis';
import { normaliserIdentifiant, proposerIdentifiant } from '@/lib/identifiants';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { BarreAction } from '@/components/tactile/barre-action';
import { creerEnseignant } from './actions';

function SubmitButton({ pleineLargeur }: { pleineLargeur?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className={pleineLargeur ? 'w-full' : undefined}
    >
      {pending ? 'Enregistrement...' : "Enregistrer l'enseignant"}
    </Button>
  );
}

export function EnseignantForm({ anneeScolaireId }: { anneeScolaireId: string }) {
  const [resultat, formAction] = useFormState(creerEnseignant, null);
  const router = useRouter();

  const [nom, setNom] = useState('');
  const [prenoms, setPrenoms] = useState('');
  const [sexe, setSexe] = useState<'M' | 'F' | ''>('');
  const [email, setEmail] = useState('');
  const [modeAcces, setModeAcces] = useState<'EMAIL' | 'IDENTIFIANT'>('EMAIL');
  const [identifiant, setIdentifiant] = useState('');
  const [identifiantTouche, setIdentifiantTouche] = useState(false);
  const [telephone, setTelephone] = useState('');
  const [adresse, setAdresse] = useState('');
  const [ecranResultatMasque, setEcranResultatMasque] = useState(false);

  const valeurIdentifiant = identifiantTouche
    ? identifiant
    : proposerIdentifiant(nom, prenoms);

  const payload = JSON.stringify({
    nom,
    prenoms,
    sexe: sexe || undefined,
    email: modeAcces === 'EMAIL' ? email : undefined,
    identifiant: modeAcces === 'IDENTIFIANT' ? valeurIdentifiant : undefined,
    telephone: telephone || undefined,
    adresse: adresse || undefined,
    // `ACTIF` en dur : un enseignant qu'on enregistre est un enseignant qui
    // travaille. Les autres statuts se posent depuis sa fiche, quand ils
    // arrivent réellement.
    statut: 'ACTIF',
    // dateNaissance et dateEmbauche sont soumis séparément via les hidden
    // inputs des DatePicker (name="dateNaissance" / "dateEmbauche") et
    // fusionnés côté serveur — voir actions.ts.
    anneeScolaireIdPourMatricule: anneeScolaireId,
  });

  // Compte ouvert sans adresse : le mot de passe ne s'affichera qu'ici, et une
  // seule fois. Tout le formulaire cède la place — il n'y a rien de plus
  // urgent à faire que de le noter.
  /**
   * Même précaution que sur `/utilisateurs/inviter` : l'état d'un
   * `useFormState` est client et survit à `router.refresh()`. Sans ce drapeau
   * et ce nettoyage, « Ajouter un autre enseignant » laisserait l'écran de
   * succès en place avec les identifiants du précédent.
   */
  const recommencer = () => {
    setEcranResultatMasque(true);
    setNom('');
    setPrenoms('');
    setSexe('');
    setEmail('');
    setIdentifiant('');
    setIdentifiantTouche(false);
    setTelephone('');
    setAdresse('');
  };

  if (resultat?.etat === 'CREE' && !ecranResultatMasque) {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-headline-sm text-text-primary">
          {resultat.nomComplet} peut se connecter
        </h3>

        <IdentifiantsRemis
          identifiant={resultat.identifiant}
          motDePasse={resultat.motDePasse}
          destinataire={resultat.nomComplet}
          actions={({ confirmer }) => (
            <>
              <Button
                type="button"
                onClick={() =>
                  confirmer(() => router.push(`/etablissement/enseignants/${resultat.enseignantId}`))
                }
              >
                Voir sa fiche et lui attribuer ses matières
              </Button>
              <Button type="button" variant="secondary" onClick={() => confirmer(recommencer)}>
                Ajouter un autre enseignant
              </Button>
            </>
          )}
        />
      </div>
    );
  }

  return (
    // Le drapeau est relevé à chaque soumission : sans cela, le second
    // enseignant créé n'afficherait jamais son mot de passe.
    <form
      action={(donnees) => {
        setEcranResultatMasque(false);
        formAction(donnees);
      }}
      className="flex flex-col gap-6 pb-zone-action md:pb-0"
    >
      <input type="hidden" name="payload" value={payload} />

      <section className="flex flex-col gap-4 rounded-lg border border-surface-border p-4">
        <h3 className="text-headline-sm text-text-primary">Identité de l&apos;enseignant</h3>
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nom">Nom de famille</Label>
            <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prenoms">Prénoms</Label>
            <Input id="prenoms" value={prenoms} onChange={(e) => setPrenoms(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sexe">Sexe</Label>
            <Select value={sexe} onValueChange={(v) => setSexe(v as 'M' | 'F')}>
              <SelectTrigger id="sexe">
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculin</SelectItem>
                <SelectItem value="F">Féminin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="telephone">Téléphone</Label>
            <Input
              id="telephone"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="+228 90 00 00 00"
            />
          </div>
          {/*
            Exiger une adresse email était le point de blocage : une grande
            partie des enseignants togolais n'en a pas, ou n'ouvre jamais la
            sienne. Leur compte n'était donc jamais activé, et le directeur
            restait seul à saisir les notes de toute l'école.
          */}
          <div className="flex flex-col gap-3 md:col-span-2">
            <Label>Comment il se connectera</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setModeAcces('EMAIL')}
                aria-pressed={modeAcces === 'EMAIL'}
                className={cn(
                  'flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors',
                  modeAcces === 'EMAIL'
                    ? 'border-primary-container bg-primary-container/10'
                    : 'border-surface-border hover:bg-surface-container',
                )}
              >
                <span className="text-body-md font-semibold text-text-primary">
                  Il a une adresse email
                </span>
                <span className="text-body-sm text-text-secondary">
                  Il reçoit une invitation et choisit son mot de passe.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setModeAcces('IDENTIFIANT')}
                aria-pressed={modeAcces === 'IDENTIFIANT'}
                className={cn(
                  'flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors',
                  modeAcces === 'IDENTIFIANT'
                    ? 'border-primary-container bg-primary-container/10'
                    : 'border-surface-border hover:bg-surface-container',
                )}
              >
                <span className="text-body-md font-semibold text-text-primary">
                  Il n&apos;a pas d&apos;adresse email
                </span>
                <span className="text-body-sm text-text-secondary">
                  Vous lui remettez un identifiant et un mot de passe.
                </span>
              </button>
            </div>

            {modeAcces === 'EMAIL' ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <div className="flex items-start gap-2 rounded-md bg-primary-container/10 p-3 text-body-sm text-text-secondary">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-container" aria-hidden />
                  <p>
                    Une invitation par email lui sera envoyée pour créer son compte. Il devra
                    l&apos;ouvrir pour se connecter.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="identifiant">Identifiant</Label>
                <Input
                  id="identifiant"
                  value={valeurIdentifiant}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => {
                    setIdentifiantTouche(true);
                    setIdentifiant(normaliserIdentifiant(e.target.value));
                  }}
                  required
                />
                <div className="flex items-start gap-2 rounded-md bg-primary-container/10 p-3 text-body-sm text-text-secondary">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-container" aria-hidden />
                  <p>
                    Le compte est prêt tout de suite. Un mot de passe s&apos;affichera après
                    l&apos;enregistrement : notez-le, il ne sera plus visible ensuite.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="adresse">Adresse</Label>
            <Input id="adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          </div>
          {/*
            Quatre champs retirés le 2026-09-15 : date de naissance, date
            d'embauche, statut initial et ancien matricule.
            Aucun n'est nécessaire pour qu'un enseignant commence à travailler,
            et chacun coûtait une hésitation à quelqu'un qui n'a pas le dossier
            sous les yeux. Le statut naît `ACTIF` — c'est le seul cas qui ait
            un sens à la création — et se change depuis la fiche. Les colonnes
            restent, l'import les remplit toujours.
          */}
        </div>
      </section>

      {resultat?.etat === 'ERREUR' && (
        <p className="text-body-sm text-error">{resultat.message}</p>
      )}
      {/* Masqué sous `md`, où la barre collée prend le relais. Voir
          `BarreAction` : on double la soumission, on ne la déplace pas. */}
      <div className="hidden justify-end gap-3 border-t border-surface-border pt-6 md:flex">
        <SubmitButton />
      </div>

      <BarreAction aide="Vous pourrez affecter des classes après l’enregistrement.">
        <SubmitButton pleineLargeur />
      </BarreAction>
    </form>
  );
}
