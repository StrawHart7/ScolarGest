import Link from 'next/link';
import { FileSpreadsheet, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Invitation à faire entrer les premiers élèves, quand l'école n'en a aucun.
 *
 * ## Pourquoi cet écran existe
 *
 * Constat du 2026-09-10 sur la base réelle : la seule école en essai avait
 * configuré ses cycles, son année, dix classes, ses matières, son programme et
 * ses coefficients — **en sept minutes** — puis s'était arrêtée à zéro élève.
 * Elle s'est reconnectée cinq jours plus tard, et est repartie sans écrire une
 * seule ligne. Ce qu'elle avait sous les yeux était un tableau de bord de zéros
 * et une liste d'élèves vide annonçant « Aucun élève trouvé ».
 *
 * Un zéro n'apprend rien. Une école qui a posé sa structure n'a plus qu'un
 * geste à faire, et c'est celui-là qu'il faut nommer.
 *
 * ## Pourquoi l'import est l'action principale
 *
 * Une école togolaise arrive avec deux à quatre cents élèves **déjà** dans un
 * tableur — c'est le fichier qu'elle tient depuis la rentrée. Lui proposer
 * « Nouvel élève » en premier, c'est lui proposer trois cents formulaires : le
 * geste est juste pour l'élève qui arrive en cours d'année, il est absurde pour
 * la première mise en service. La saisie manuelle reste offerte, en second.
 *
 * ## Pourquoi la phrase de réassurance
 *
 * Ce qui retient quelqu'un devant un import, c'est de ne pas savoir ce que le
 * dépôt va écrire. L'analyse en deux temps répond exactement à cette crainte —
 * elle montre ce qui passe et ce qui bloque, et n'écrit qu'à la confirmation —
 * mais encore faut-il le dire **avant** le clic, pas sur la page d'après.
 */
export function InvitationPremiersEleves({
  /**
   * Poser le bloc dans sa propre carte.
   *
   * Sur la liste des élèves il s'insère dans une carte existante ; l'y
   * envelopper doublerait la bordure. Sur le tableau de bord il est seul.
   */
  avecCarte = false,
}: {
  avecCarte?: boolean;
}) {
  const contenu = (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <div className="rounded-full bg-primary-fixed p-3">
        <FileSpreadsheet className="h-7 w-7 text-primary-container" aria-hidden />
      </div>

      <div className="space-y-1">
        <p className="text-headline-sm text-text-primary">Aucun élève pour le moment</p>
        <p className="mx-auto max-w-md text-body-sm text-text-secondary">
          Votre école est configurée. Il ne manque que les élèves — et s&apos;ils sont déjà dans un
          fichier Excel, vous n&apos;avez rien à ressaisir.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild size="sm">
          <Link href="/etablissement/eleves/import">
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Importer un fichier Excel
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/etablissement/eleves/nouvelle">
            <UserPlus className="h-4 w-4" aria-hidden />
            Saisir un élève
          </Link>
        </Button>
      </div>

      <p className="mx-auto max-w-md text-label-md text-text-secondary">
        Rien n&apos;est enregistré avant votre confirmation : le fichier est d&apos;abord analysé, et
        la plateforme vous montre ligne par ligne ce qui passe et ce qui bloque.
      </p>
    </div>
  );

  if (!avecCarte) return contenu;

  return (
    <Card>
      <CardContent className="p-0">{contenu}</CardContent>
    </Card>
  );
}
