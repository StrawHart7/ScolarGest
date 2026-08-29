'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Saisie du code de confirmation à l'intérieur d'une étape.
 *
 * `ConfirmationPin` (`src/components/ui/confirmation-pin.tsx`) reste le
 * composant de référence ailleurs dans l'application, mais il ouvre une
 * boîte de dialogue autour d'une action ponctuelle. Ici le code fait partie
 * du formulaire de l'étape et est saisi **une fois pour tout le lot** — un
 * dialogue par cycle activé rendrait l'étape pénible sans rien ajouter en
 * sécurité, la vérification restant serveur (`exigerPin`) à chaque appel.
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
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={valeur}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder="••••••"
        className="mt-1 max-w-[10rem] tracking-[0.4em]"
      />
      <p className="mt-1 text-body-sm text-text-secondary">{aide}</p>
    </div>
  );
}
