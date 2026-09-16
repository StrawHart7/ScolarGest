'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { ApercuFiligrane } from './ApercuFiligrane';
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
 *
 * ## Les deux réglages se voient avant d'être posés
 *
 * C'est le seul écran du produit qui décide de ce qui sera **imprimé**, et il
 * n'en montrait rien : deux champs et six phrases grises. On choisissait son
 * logo sans le voir, et son filigrane sans savoir à quoi il ressemblerait, la
 * seule vérification possible étant de générer un bulletin. D'où un
 * emplacement de logo à la forme qu'il aura sur le document, et une vignette
 * de filigrane (`ApercuFiligrane`).
 *
 * ## Le champ de fichier natif n'a pas sa place ici non plus
 *
 * C'était le dernier du produit : bouton et libellé du système, en anglais sur
 * un navigateur en anglais, au milieu d'un formulaire français. `ZoneDepot`
 * l'avait retiré des trois écrans d'import le 2026-09-04 et celui-ci était
 * resté. Même parade — l'`input` demeure, masqué en `sr-only` et non en
 * `display:none` qui le sortirait du parcours clavier, et l'emplacement du
 * logo devient la cible.
 *
 * Il n'est pas remplacé par `ZoneDepot` lui-même : cette zone-là est faite pour
 * un tableur, dont il n'y a rien à montrer sinon un nom de fichier. Un logo se
 * regarde, et sa vignette est à la fois l'aperçu et la cible.
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

/**
 * Les deux règles de `televerserLogo`, reprises telles quelles.
 *
 * Le service refuse déjà, et c'est lui qui fait foi ; les redire ici évite
 * seulement d'apprendre au retour du serveur qu'un fichier de 4 Mo ne passait
 * pas — sur une connexion togolaise, l'aller-retour se paie.
 */
const TYPES_LOGO = ['image/png', 'image/jpeg', 'image/webp'];
const TAILLE_MAX_LOGO = 1024 * 1024;

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
  const [choisi, setChoisi] = React.useState<File | null>(null);
  const [apercuChoisi, setApercuChoisi] = React.useState<string | null>(null);
  const [erreurFichier, setErreurFichier] = React.useState<string | null>(null);
  const [survole, setSurvole] = React.useState(false);
  const champFichier = React.useRef<HTMLInputElement>(null);

  // Une URL d'objet non révoquée retient l'image en mémoire tant que l'onglet
  // vit — et cet écran se visite en changeant plusieurs fois de fichier.
  React.useEffect(() => {
    if (!choisi) {
      setApercuChoisi(null);
      return;
    }
    const url = URL.createObjectURL(choisi);
    setApercuChoisi(url);
    return () => URL.revokeObjectURL(url);
  }, [choisi]);

  function retenirFichier(fichier: File | null) {
    if (champFichier.current) champFichier.current.value = '';
    if (!fichier) {
      setChoisi(null);
      setErreurFichier(null);
      return;
    }
    if (!TYPES_LOGO.includes(fichier.type)) {
      setChoisi(null);
      setErreurFichier('Format non accepté. Choisissez un PNG, un JPEG ou un WebP.');
      return;
    }
    if (fichier.size > TAILLE_MAX_LOGO) {
      setChoisi(null);
      setErreurFichier(
        `Cette image pèse ${(fichier.size / 1024 / 1024).toFixed(1)} Mo, pour 1 Mo au maximum.`,
      );
      return;
    }
    setErreurFichier(null);
    setChoisi(fichier);
  }

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

  async function envoyerLogo() {
    if (!choisi) return;
    const donnees = new FormData();
    donnees.append('logo', choisi);
    setEnCours(true);
    const resultat = await appeler(() => televerserLogoAction(donnees));
    setEnCours(false);
    if (!resultat.ok) {
      toastErreur(resultat.message);
      return;
    }
    succes(resultat.message ?? 'Logo enregistré.');
    retenirFichier(null);
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

  // L'image montrée dans l'emplacement : le fichier qu'on vient de choisir s'il
  // y en a un, sinon le logo en vigueur. Le cadre change de teinte dans le
  // premier cas — ce qu'on voit n'est alors pas encore ce qui est enregistré.
  const imageCadre = apercuChoisi ?? logoApercu;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Logo de l&apos;établissement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {/* L'emplacement du logo, à la forme qu'il aura sur le document
                (`max-height: 64px; max-width: 120px` dans le gabarit), et
                cliquable de bout en bout. Vide, il garde sa place : un cadre
                en pointillés dit ce qui manque et où cela ira, là où la phrase
                « Aucun logo » se confondait avec le reste du texte gris. */}
            <label
              onDragOver={(e) => {
                e.preventDefault();
                if (!enCours) setSurvole(true);
              }}
              onDragLeave={() => setSurvole(false)}
              onDrop={(e) => {
                e.preventDefault();
                setSurvole(false);
                if (enCours) return;
                const depose = e.dataTransfer.files?.[0];
                if (depose) retenirFichier(depose);
              }}
              className={`flex h-24 w-40 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 p-2 transition-colors ${
                survole
                  ? 'border-solid border-primary bg-primary/5'
                  : apercuChoisi
                    ? 'border-solid border-primary/40 bg-primary/5'
                    : imageCadre
                      ? 'border-solid border-surface-border bg-surface-container-lowest hover:border-primary/50'
                      : 'border-dashed border-surface-border bg-surface-container-low hover:border-primary/50 hover:bg-primary/5'
              } ${enCours ? 'pointer-events-none opacity-60' : ''}`}
            >
              {imageCadre ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={imageCadre}
                  alt={apercuChoisi ? 'Logo choisi, pas encore enregistré' : 'Logo actuel'}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="flex flex-col items-center gap-1 text-center">
                  <ImagePlus className="h-5 w-5 text-text-secondary" aria-hidden />
                  <span className="text-body-sm text-text-secondary">Aucun logo</span>
                </span>
              )}
              <input
                ref={champFichier}
                id="logo"
                name="logo"
                type="file"
                accept={TYPES_LOGO.join(',')}
                aria-label="Choisir une image pour le logo"
                disabled={enCours}
                className="sr-only"
                onChange={(e) => retenirFichier(e.target.files?.[0] ?? null)}
              />
            </label>

            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-body-sm text-text-secondary">
                Affiché en en-tête des bulletins et des reçus, centré au-dessus du nom de
                l&apos;établissement. PNG, JPEG ou WebP, 1 Mo maximum.
              </p>

              {choisi ? (
                <>
                  <p className="truncate text-body-sm text-text-primary">
                    <span className="font-medium">{choisi.name}</span>
                    <span className="text-text-secondary">
                      {' '}
                      — {(choisi.size / 1024).toFixed(0)} Ko
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={enCours}
                      onClick={envoyerLogo}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" aria-hidden />
                      {enCours ? 'Envoi…' : 'Enregistrer ce logo'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={enCours}
                      onClick={() => retenirFichier(null)}
                    >
                      Annuler
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={enCours}
                    onClick={() => champFichier.current?.click()}
                    className="gap-2"
                  >
                    <ImagePlus className="h-4 w-4" aria-hidden />
                    {logoApercu ? 'Remplacer le logo' : 'Choisir une image'}
                  </Button>
                  {logoApercu && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={enCours}
                      onClick={retirerLogo}
                      className="gap-2 text-text-secondary"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Retirer
                    </Button>
                  )}
                </div>
              )}

              {erreurFichier && (
                <p className="text-body-sm text-error" role="alert">
                  {erreurFichier}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filigrane</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <ApercuFiligrane texte={texte.trim()} actif={actif} />

            <div className="min-w-0 flex-1 space-y-4">
              <p className="text-body-sm text-text-secondary">
                Répété en fond de chaque page des bulletins et des reçus. C&apos;est un élément
                d&apos;identité visuelle : il ne protège pas contre la falsification.
              </p>

              <div>
                <Label htmlFor="filigrane-texte">Texte du filigrane</Label>
                <Input
                  id="filigrane-texte"
                  value={texte}
                  onChange={(e) => {
                    const nouveau = e.target.value;
                    // Saisir un texte de filigrane sans l'activer enregistre un
                    // réglage sans effet visible : on active dès la première
                    // saisie, l'utilisateur restant libre de décocher ensuite
                    // pour le masquer sans perdre son texte.
                    if (texte.trim() === '' && nouveau.trim() !== '') setActif(true);
                    setTexte(nouveau);
                  }}
                  maxLength={60}
                  placeholder="Nom de votre établissement, COPIE, ORIGINAL…"
                  className="mt-1"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="filigrane-actif"
                  checked={actif}
                  onCheckedChange={(v) => setActif(v === true)}
                  disabled={texte.trim() === ''}
                />
                <Label htmlFor="filigrane-actif" className="cursor-pointer text-text-primary">
                  Afficher le filigrane sur les documents
                </Label>
              </div>

              {texte.trim() === '' && actif && (
                <p className="text-body-sm text-text-secondary">
                  Saisissez un texte pour pouvoir activer le filigrane.
                </p>
              )}
              {texte.trim() !== '' && !actif && (
                <p className="text-body-sm text-warning-on-container">
                  Le texte est enregistré mais n&apos;apparaîtra pas sur les documents tant que la
                  case ci-dessus reste décochée.
                </p>
              )}
            </div>
          </div>
        </CardContent>

        {/* L'action de la carte, détachée par un filet : ce qui précède est un
            réglage qu'on essaie — la vignette suit la frappe — et rien n'est
            écrit avant ce bouton. Le logo, lui, part à l'envoi : les deux
            cartes ne s'enregistrent pas au même moment, autant que ça se voie. */}
        <div className="flex justify-end border-t border-surface-border px-6 py-4">
          <Button type="button" disabled={enCours} onClick={enregistrerFiligrane}>
            {enCours ? 'Enregistrement…' : 'Enregistrer le filigrane'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
