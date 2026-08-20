'use client';

import * as React from 'react';
import { UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FormulaireModal } from '@/components/ui/form-modal';
import { ajouterResponsableAction, modifierResponsableAction } from './actions';

export interface ResponsableModifiable {
  responsableId: string;
  nom: string;
  prenoms: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  profession: string | null;
  type: 'PERE' | 'MERE' | 'TUTEUR' | 'AUTRE';
}

const TYPES = [
  { valeur: 'PERE', libelle: 'Père' },
  { valeur: 'MERE', libelle: 'Mère' },
  { valeur: 'TUTEUR', libelle: 'Tuteur' },
  { valeur: 'AUTRE', libelle: 'Autre' },
];

function ChampsResponsable({
  prefixe,
  valeurs,
}: {
  prefixe: string;
  valeurs?: Partial<ResponsableModifiable>;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefixe}-nom`}>Nom</Label>
          <Input id={`${prefixe}-nom`} name="nom" defaultValue={valeurs?.nom ?? ''} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefixe}-prenoms`}>Prénoms</Label>
          <Input
            id={`${prefixe}-prenoms`}
            name="prenoms"
            defaultValue={valeurs?.prenoms ?? ''}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefixe}-type`}>Qualité</Label>
          <Select name="type" defaultValue={valeurs?.type ?? 'PERE'}>
            <SelectTrigger id={`${prefixe}-type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t.valeur} value={t.valeur}>
                  {t.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefixe}-telephone`}>Téléphone</Label>
          <Input
            id={`${prefixe}-telephone`}
            name="telephone"
            type="tel"
            defaultValue={valeurs?.telephone ?? ''}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefixe}-email`}>E-mail</Label>
          <Input
            id={`${prefixe}-email`}
            name="email"
            type="email"
            defaultValue={valeurs?.email ?? ''}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefixe}-profession`}>Profession</Label>
          <Input
            id={`${prefixe}-profession`}
            name="profession"
            defaultValue={valeurs?.profession ?? ''}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${prefixe}-adresse`}>Adresse</Label>
        <Input id={`${prefixe}-adresse`} name="adresse" defaultValue={valeurs?.adresse ?? ''} />
      </div>
    </>
  );
}

export function ModifierResponsableForm({
  eleveId,
  responsable,
}: {
  eleveId: string;
  responsable: ResponsableModifiable;
}) {
  return (
    <FormulaireModal
      action={modifierResponsableAction}
      titre={`Modifier ${responsable.nom} ${responsable.prenoms}`}
      description="Le téléphone du responsable est le canal de contact de l'école avec la famille : il doit rester à jour."
      declencheur="Modifier"
      iconeDeclencheur={null}
      varianteDeclencheur="secondary"
      libelleValidation="Enregistrer"
      messageSucces="Responsable modifié"
    >
      <input type="hidden" name="responsableId" value={responsable.responsableId} />
      <input type="hidden" name="eleveId" value={eleveId} />
      <ChampsResponsable prefixe={`modif-${responsable.responsableId}`} valeurs={responsable} />
    </FormulaireModal>
  );
}

export function AjouterResponsableForm({ eleveId }: { eleveId: string }) {
  return (
    <FormulaireModal
      action={ajouterResponsableAction}
      titre="Ajouter un responsable légal"
      description="Un seul responsable peut être principal : le désigner ici retire la mention à l'ancien."
      declencheur="Ajouter un responsable"
      iconeDeclencheur={<UserPlus className="h-4 w-4" aria-hidden />}
      varianteDeclencheur="secondary"
      libelleValidation="Ajouter"
      messageSucces="Responsable ajouté"
    >
      <input type="hidden" name="eleveId" value={eleveId} />
      <ChampsResponsable prefixe="ajout" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lienParente">Lien de parenté</Label>
        <Input id="lienParente" name="lienParente" placeholder="Père, Mère, Oncle…" required />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="principal" name="principal" />
        <Label htmlFor="principal" className="cursor-pointer">
          Responsable principal
        </Label>
      </div>
    </FormulaireModal>
  );
}
