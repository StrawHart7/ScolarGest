'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Ressaisie du code de confirmation à l'intérieur d'une étape.
 *
 * `ConfirmationPin` (`src/components/ui/confirmation-pin.tsx`) reste le
 * composant de référence ailleurs dans l'application, mais il ouvre une
 * boîte de dialogue autour d'une action ponctuelle. Ici le code fait partie
 * du formulaire de l'étape et est saisi **une fois pour tout le lot** — un
 * dialogue par cycle activé rendrait l'étape pénible sans rien ajouter en
 * sécurité, la vérification restant serveur (`exigerPin`) à chaque appel.
 *
 * Champ `type="text"` et non `password` : masqué, il était pris pour cible par
 * le gestionnaire de mots de passe, qui y injectait le mot de passe du compte.
 * Le filtre ne gardant que les chiffres, la valeur était alors silencieusement
 * tronquée et l'étape échouait sans explication. Le code reste secret, mais il
 * vient d'être choisi par l'utilisateur à l'étape précédente.
 */
export function ChampPin({
  valeur,
  onChange,
  aide,
}: {
  valeur: string;
  onChange: (valeur: string) => void;
  aide: string;
}) {
  return (
    <div>
      <Label htmlFor="pin-confirmation-etape">Code de confirmation</Label>
      <Input
        id="pin-confirmation-etape"
        name="code-confirmation-etape"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        maxLength={6}
        value={valeur}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
        className="mt-1 max-w-[10rem] text-center tracking-[0.5em]"
      />
      <p className="mt-1 text-body-sm text-text-secondary">
        {aide}
        {valeur.length > 0 && valeur.length < 6 && (
          <span className="text-error"> Encore {6 - valeur.length} chiffre{6 - valeur.length > 1 ? 's' : ''}.</span>
        )}
      </p>
    </div>
  );
}
