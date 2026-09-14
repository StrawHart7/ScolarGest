'use client';

import * as React from 'react';
import { FileSpreadsheet, UploadCloud, X } from 'lucide-react';

/**
 * Le dépôt d'un fichier, sans champ natif.
 *
 * ## Pourquoi remplacer l'`input[type=file]`
 *
 * C'était **le seul champ non stylable du produit**, et il le montrait : bouton
 * du système, police du système, nom du fichier en clair. Il portait aussi une
 * largeur minimale intrinsèque que le navigateur refuse de réduire — d'où les
 * cinq pixels de débordement relevés sur les trois écrans d'import le
 * 2026-09-04, seul débordement horizontal du produit avec celui des
 * statistiques.
 *
 * L'`input` existe toujours : c'est lui qui ouvre le sélecteur et qui porte le
 * fichier. Il est simplement **visuellement masqué** — `sr-only` et non
 * `display:none`, qui le retirerait du parcours clavier — et le `label`
 * enveloppant devient la cible. On ne perd donc rien de l'accessibilité d'un
 * champ natif.
 *
 * ## Le glisser-déposer ne remplace pas le clic
 *
 * Il s'y ajoute. Sur un téléphone il n'existe pas, et sur un poste partagé
 * l'utilisateur ne l'essaie pas toujours : la zone reste cliquable de bout en
 * bout, et le texte annonce les deux gestes.
 *
 * ## Le fichier choisi se retire
 *
 * Sans ce bouton, se tromper de fichier obligeait à rouvrir le sélecteur pour
 * en désigner un autre — ou à recharger la page, ce qui perd l'analyse déjà
 * faite. Le retrait remet l'écran à son état initial, explicitement.
 */
export function ZoneDepot({
  fichier,
  onChoisir,
  accept = '.xlsx,.xls',
  desactive = false,
}: {
  fichier: File | null;
  onChoisir: (fichier: File | null) => void;
  accept?: string;
  desactive?: boolean;
}) {
  const [survole, setSurvole] = React.useState(false);
  const champ = React.useRef<HTMLInputElement>(null);

  function deposer(evenement: React.DragEvent) {
    evenement.preventDefault();
    setSurvole(false);
    if (desactive) return;
    const depose = evenement.dataTransfer.files?.[0];
    if (depose) onChoisir(depose);
  }

  function retirer(evenement: React.MouseEvent) {
    // Le bouton vit dans le `label` : sans cette interception, le clic
    // rouvrirait le sélecteur de fichier au lieu de vider le champ.
    evenement.preventDefault();
    evenement.stopPropagation();
    onChoisir(null);
    if (champ.current) champ.current.value = '';
  }

  if (fichier) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
        <FileSpreadsheet className="h-6 w-6 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-md font-medium text-text-primary">{fichier.name}</p>
          <p className="text-body-sm text-text-secondary">
            {(fichier.size / 1024).toFixed(0)} Ko — prêt à être analysé
          </p>
        </div>
        <button
          type="button"
          onClick={retirer}
          disabled={desactive}
          aria-label="Retirer ce fichier"
          className="flex h-row-standard w-row-standard shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-container hover:text-text-primary disabled:opacity-40"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!desactive) setSurvole(true);
      }}
      onDragLeave={() => setSurvole(false)}
      onDrop={deposer}
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
        survole
          ? 'border-primary bg-primary/5'
          : 'border-surface-border bg-surface-container-lowest hover:border-primary/50 hover:bg-primary/5'
      } ${desactive ? 'pointer-events-none opacity-50' : ''}`}
    >
      <UploadCloud className="h-8 w-8 text-text-secondary" aria-hidden />
      <span className="text-body-md font-medium text-text-primary">
        Choisissez votre fichier Excel
      </span>
      <span className="text-body-sm text-text-secondary">
        ou glissez-le ici — formats .xlsx et .xls
      </span>
      <input
        ref={champ}
        type="file"
        name="fichier"
        accept={accept}
        disabled={desactive}
        className="sr-only"
        onChange={(e) => onChoisir(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
