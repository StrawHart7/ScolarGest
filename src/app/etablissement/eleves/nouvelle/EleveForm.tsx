'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { BarreAction } from '@/components/tactile/barre-action';
import { lienParenteDepuisType } from '@/lib/responsables';
import { creerEleve } from './actions';

interface ResponsableDraft {
  nom: string;
  prenoms: string;
  telephone: string;
  email: string;
  profession: string;
  type: 'PERE' | 'MERE' | 'TUTEUR' | 'AUTRE';
  principal: boolean;
}

function newResponsable(principal: boolean): ResponsableDraft {
  return {
    nom: '',
    prenoms: '',
    telephone: '',
    email: '',
    profession: '',
    type: 'PERE',
    principal,
  };
}

function SubmitButton({ pleineLargeur }: { pleineLargeur?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className={pleineLargeur ? 'w-full' : undefined}
    >
      {pending ? 'Enregistrement...' : "Enregistrer l'élève"}
    </Button>
  );
}

/**
 * Valeur du choix « pas encore de classe ».
 *
 * Un `Select` ne peut pas porter la valeur vide, et le champ doit rester
 * obligatoire : c'est ce qui empêche de créer un élève invisible sans l'avoir
 * décidé. Le cas existe pourtant — un dossier ouvert avant la rentrée — et il
 * garde donc une option explicite qui dit sa conséquence.
 */
const SANS_CLASSE = 'SANS_CLASSE';

export function EleveForm({
  anneeScolaireId,
  classes,
}: {
  anneeScolaireId: string;
  classes: { id: string; nom: string; niveau: { nom: string } }[];
}) {
  const [error, formAction] = useFormState(creerEleve, null);

  const [classeId, setClasseId] = useState('');
  const [nom, setNom] = useState('');
  const [prenoms, setPrenoms] = useState('');
  const [sexe, setSexe] = useState<'M' | 'F' | ''>('');
  const [lieuNaissance, setLieuNaissance] = useState('');
  const [nationalite, setNationalite] = useState('');
  const [responsables, setResponsables] = useState<ResponsableDraft[]>([newResponsable(true)]);

  function updateResponsable(index: number, patch: Partial<ResponsableDraft>) {
    setResponsables((prev) =>
      prev.map((r, i) => {
        if (i !== index) {
          // Un seul principal=true côté formulaire : si l'index courant devient
          // principal, désactive les autres immédiatement (aperçu client — la
          // garantie définitive reste portée par la RPC côté serveur).
          if (patch.principal === true) return { ...r, principal: false };
          return r;
        }
        return { ...r, ...patch };
      }),
    );
  }

  function addResponsable() {
    setResponsables((prev) => [...prev, newResponsable(false)]);
  }

  function removeResponsable(index: number) {
    setResponsables((prev) => prev.filter((_, i) => i !== index));
  }

  const payload = JSON.stringify({
    nom,
    prenoms,
    sexe: sexe || undefined,
    lieuNaissance: lieuNaissance || undefined,
    nationalite: nationalite || undefined,
    // dateNaissance is submitted separately via the DatePicker's own hidden
    // input (name="dateNaissance") and merged server-side — see actions.ts.
    anneeScolaireIdPourMatricule: anneeScolaireId,
    classeId: classeId && classeId !== SANS_CLASSE ? classeId : undefined,
    responsables: responsables.map((r) => ({
      ...r,
      // La colonne `lienParente` est `not null` en base : elle est remplie
      // depuis le type, qui porte déjà la réponse.
      lienParente: lienParenteDepuisType(r.type),
      email: r.email || undefined,
      telephone: r.telephone || undefined,
      profession: r.profession || undefined,
    })),
  });

  return (
    <form action={formAction} className="flex flex-col gap-6 pb-zone-action md:pb-0">
      <input type="hidden" name="payload" value={payload} />

      {/*
        L'inscription en classe se faisait sur un **second écran**, qu'il
        fallait trouver depuis la fiche de l'élève une fois celui-ci créé.
        Deux tables — `eleve` et `inscription` — donc deux écrans, alors que le
        directeur fait un seul geste : il inscrit un enfant en 6ème A.

        La conséquence n'était pas seulement un clic de plus. C'est
        l'inscription qui génère la facture : tant que le second écran n'était
        pas trouvé, l'enfant n'avait ni classe, ni facture, ni place dans les
        effectifs — et le directeur croyait avoir fini.

        La classe est donc le **premier** champ, avant l'identité : c'est la
        décision, le reste est de la saisie.
      */}
      {/* Pas de carte bordée sous `md` : le formulaire compte quatre sections,
          et une bordure pleine pour un seul champ coûte une hauteur que la page
          n'a pas sur un écran de 390px. Le titre suffit à séparer. */}
      <section className="flex flex-col gap-4 md:rounded-lg md:border md:border-surface-border md:p-4">
        <h3 className="text-headline-sm text-text-primary">Classe</h3>
        <div className="flex flex-col gap-1.5 md:max-w-sm">
          <Label htmlFor="classeId">Inscrire en</Label>
          <Select value={classeId} onValueChange={setClasseId} required>
            <SelectTrigger id="classeId">
              <SelectValue placeholder="Choisir une classe" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nom} — {c.niveau.nom}
                </SelectItem>
              ))}
              <SelectItem value={SANS_CLASSE}>Pas encore — je l&apos;inscrirai plus tard</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-body-sm text-text-secondary">
            {classeId && classeId !== SANS_CLASSE
              ? 'Sa facture sera créée automatiquement à partir des tarifs de cette classe.'
              : 'Sans classe, l’élève n’apparaît ni dans les effectifs, ni dans les factures.'}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-surface-border p-4">
        <h3 className="text-headline-sm text-text-primary">Identité de l&apos;élève</h3>
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
            <Label htmlFor="dateNaissance">Date de naissance</Label>
            <DatePicker id="dateNaissance" name="dateNaissance" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lieuNaissance">Lieu de naissance</Label>
            <Input id="lieuNaissance" value={lieuNaissance} onChange={(e) => setLieuNaissance(e.target.value)} />
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
            <Label htmlFor="nationalite">Nationalité</Label>
            <Input id="nationalite" value={nationalite} onChange={(e) => setNationalite(e.target.value)} />
          </div>
          {/*
            « Ancien matricule » est parti le 2026-09-15. Il était écrit à la
            création et plus jamais relu : la recherche d'élèves porte sur le
            nom, les prénoms et le matricule, pas sur lui, et la détection de
            doublons à l'import l'ignore. On demandait donc une information
            qu'on ne pouvait même pas retrouver — et son intitulé laissait
            croire à un champ important.
          */}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-surface-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-headline-sm text-text-primary">Responsables légaux</h3>
          <Button type="button" variant="secondary" size="sm" onClick={addResponsable}>
            <Plus className="h-4 w-4" aria-hidden />
            Ajouter un responsable
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
          {responsables.map((r, index) => (
            <div key={index} className="space-y-4 rounded-lg border border-surface-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-label-md uppercase tracking-wide text-text-secondary">
                  Responsable {index + 1}
                </p>
                {responsables.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeResponsable(index)}
                    className="rounded p-1 text-text-secondary transition-colors hover:bg-surface-container hover:text-error"
                    aria-label={`Retirer le responsable ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id={`principal-${index}`}
                  checked={r.principal}
                  onCheckedChange={(checked) => updateResponsable(index, { principal: checked === true })}
                />
                <Label htmlFor={`principal-${index}`} className="normal-case">
                  Responsable principal
                </Label>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`type-${index}`}>Type</Label>
                <Select
                  value={r.type}
                  onValueChange={(v) => updateResponsable(index, { type: v as ResponsableDraft['type'] })}
                >
                  <SelectTrigger id={`type-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERE">Père</SelectItem>
                    <SelectItem value="MERE">Mère</SelectItem>
                    <SelectItem value="TUTEUR">Tuteur</SelectItem>
                    <SelectItem value="AUTRE">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/*
                « Lien de parenté » est parti le 2026-09-15 : le menu « Type »
                juste au-dessus dit déjà père, mère ou tuteur. Deux champs pour
                une seule réponse, dans un formulaire qui compte quatre
                sections. La colonne en base reste, remplie depuis le type.
              */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`nomResponsable-${index}`}>Nom de famille</Label>
                  <Input
                    id={`nomResponsable-${index}`}
                    value={r.nom}
                    onChange={(e) => updateResponsable(index, { nom: e.target.value })}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`prenomsResponsable-${index}`}>Prénoms</Label>
                  <Input
                    id={`prenomsResponsable-${index}`}
                    value={r.prenoms}
                    onChange={(e) => updateResponsable(index, { prenoms: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`telephone-${index}`}>Téléphone</Label>
                <Input
                  id={`telephone-${index}`}
                  type="tel"
                  inputMode="tel"
                  value={r.telephone}
                  onChange={(e) => updateResponsable(index, { telephone: e.target.value })}
                  placeholder="+228 90 00 00 00"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`email-${index}`}>Email</Label>
                <Input
                  id={`email-${index}`}
                  type="email"
                  value={r.email}
                  onChange={(e) => updateResponsable(index, { email: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`profession-${index}`}>Profession</Label>
                <Input
                  id={`profession-${index}`}
                  value={r.profession}
                  onChange={(e) => updateResponsable(index, { profession: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && <p className="text-body-sm text-error">{error}</p>}

      {/*
        Le bouton reste dans le flux — il est simplement masqué sous `md`, où la
        barre collée prend le relais. On double la soumission, on ne la déplace
        pas : un formulaire dont le bouton n'existe que dans une barre flottante
        devient insoumettable si un clavier virtuel la recouvre.
      */}
      <div className="hidden justify-end gap-3 border-t border-surface-border pt-6 md:flex">
        <SubmitButton />
      </div>

      <BarreAction aide="Vous pourrez modifier la fiche après l’enregistrement.">
        <SubmitButton pleineLargeur />
      </BarreAction>
    </form>
  );
}
