'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ImageOff, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import {
  enregistrerFiligraneAction,
  televerserLogoAction,
  supprimerLogoAction,
  type ResultatParametres,
} from './actions';

/**
 * Réglages d'identité visuelle des documents générés (bulletins et reçus).
 *
 * Le filigrane est un texte libre : nom de l'établissement, « COPIE »,
 * « ORIGINAL », une devise. Il n'a pas vocation à authentifier un document —
 * un filigrane se copie — mais à porter l'identité de l'école.
 */

/** Même garde que sur le questionnaire de démarrage : une action interrompue
 *  peut se résoudre sur `undefined`, et `resultat.ok` lèverait alors. */
async function appeler(
  appel: () => Promise<ResultatParametres | undefined>,
): Promise<ResultatParametres> {
  try {
    const resultat = await appel();
    if (!resultat || typeof resultat.ok !== 'boolean') {
      return { ok: false, message: "Le serveur n'a pas répondu. Réessayez." };
    }
    return resultat;
  } catch {
    return { ok: false, message: 'Connexion interrompue. Réessayez.' };
  }
}

export function ParametresDocumentForm({
  filigraneTexteInitial,
  filigraneActifInitial,
  logoApercu,
}: {
  filigraneTexteInitial: string | null;
  filigraneActifInitial: boolean;
  logoApercu: string | null;
}) {
  const router = useRouter();
  const { succes, erreur: toastErreur } = useToast();

  const [texte, setTexte] = React.useState(filigraneTexteInitial ?? '');
  const [actif, setActif] = React.useState(filigraneActifInitial);
  const [enCours, setEnCours] = React.useState(false);
  const champFichier = React.useRef<HTMLInputElement>(null);

  async function enregistrerFiligrane() {
    setEnCours(true);
    const resultat = await appeler(() =>
      enregistrerFiligraneAction({ filigraneTexte: texte.trim() || null, filigraneActif: actif }),
    );
    setEnCours(false);
    if (!resultat.ok) {
      toastErreur(resultat.message);
      return;
    }
    succes(resultat.message ?? 'Paramètres enregistrés.');
    router.refresh();
  }

  async function envoyerLogo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const donnees = new FormData(e.currentTarget);
    setEnCours(true);
    const resultat = await appeler(() => televerserLogoAction(donnees));
    setEnCours(false);
    if (!resultat.ok) {
      toastErreur(resultat.message);
      return;
    }
    succes(resultat.message ?? 'Logo enregistré.');
    if (champFichier.current) champFichier.current.value = '';
    router.refresh();
  }

  async function retirerLogo() {
    setEnCours(true);
    const resultat = await appeler(() => supprimerLogoAction());
    setEnCours(false);
    if (!resultat.ok) {
      toastErreur(resultat.message);
      return;
    }
    succes(resultat.message ?? 'Logo retiré.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Logo de l&apos;établissement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-body-sm text-text-secondary">
            Affiché en en-tête des bulletins et des reçus. PNG, JPEG ou WebP, 1 Mo maximum.
          </p>

          {logoApercu ? (
            <div className="flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoApercu}
                alt="Logo actuel de l'établissement"
                className="h-16 w-auto max-w-[120px] rounded border border-surface-border bg-surface-container-lowest object-contain p-1"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={enCours}
                onClick={retirerLogo}
                className="gap-2"
              >
                <ImageOff className="h-4 w-4" aria-hidden />
                Retirer le logo
              </Button>
            </div>
          ) : (
            <p className="text-body-sm text-text-secondary">Aucun logo enregistré.</p>
          )}

          <form onSubmit={envoyerLogo} className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="logo">Choisir une image</Label>
              <input
                ref={champFichier}
                id="logo"
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                required
                className="mt-1 block text-body-sm text-text-primary"
              />
            </div>
            <Button type="submit" disabled={enCours} className="gap-2">
              <Upload className="h-4 w-4" aria-hidden />
              {enCours ? 'Envoi…' : 'Envoyer'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filigrane</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-body-sm text-text-secondary">
            Texte affiché en fond de page, en diagonale et très estompé, sur chaque page des
            bulletins et des reçus. C&apos;est un élément d&apos;identité visuelle : il ne protège
            pas contre la falsification.
          </p>

          <div>
            <Label htmlFor="filigrane-texte">Texte du filigrane</Label>
            <Input
              id="filigrane-texte"
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              maxLength={60}
              placeholder="Nom de votre établissement, COPIE, ORIGINAL…"
              className="mt-1 max-w-md"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="filigrane-actif"
              checked={actif}
              onCheckedChange={(v) => setActif(v === true)}
              disabled={texte.trim() === ''}
            />
            <Label htmlFor="filigrane-actif" className="cursor-pointer">
              Afficher le filigrane sur les documents
            </Label>
          </div>
          {texte.trim() === '' && actif && (
            <p className="text-body-sm text-text-secondary">
              Saisissez un texte pour pouvoir activer le filigrane.
            </p>
          )}

          <div className="flex justify-end">
            <Button type="button" disabled={enCours} onClick={enregistrerFiligrane}>
              {enCours ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
