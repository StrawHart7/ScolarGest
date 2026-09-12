-- Piece jointe sur la REPONSE du support.
--
-- `0024` a ouvert le canal dans un seul sens : l'ecole envoie son fichier
-- d'import, le support le recoit. Elle ne fermait pas la boucle. Le support
-- remet les colonnes en forme, puis n'a aucun moyen de rendre le fichier
-- corrige — il le decrit par ecrit, ou repasse par un email hors produit, ce
-- qui sort la piece jointe du perimetre que la RLS protege.
--
-- Deux colonnes miroir de `fichierChemin` / `fichierNom`, meme bucket, meme
-- raisonnement : une seule piece jointe et non une collection. Le besoin est
-- « le fichier corrige », au singulier. Une colonne devient une table le jour
-- ou le besoin change ; l'inverse ne se fait pas.

alter table support_demande
  add column "reponseFichierChemin" text,
  add column "reponseFichierNom" text;

comment on column support_demande."reponseFichierChemin" is
  'Chemin dans le bucket `support`, sous le prefixe de l''etablissement de la demande,
   dans le sous-dossier `reponse`. Null si la reponse ne porte aucun fichier.';
comment on column support_demande."reponseFichierNom" is
  'Nom d''origine du fichier renvoye par le support. Le chemin de stockage est randomise ;
   sans ce champ l''ecole telechargerait un fichier au nom illisible.';

-- Aucune policy a creer, et c'est verifie plutot que suppose :
--
-- * Ecriture — `support_demande_update_super_admin` (0023) est `for update` sur
--   la ligne entiere, pas colonne par colonne. Les deux nouvelles colonnes sont
--   donc deja reservees au SUPER_ADMIN, comme `statut` et `reponseSupport`.
-- * Lecture — `support_demande_select` (20260907221109) rend la ligne visible a
--   son seul auteur. L'ecole lit donc la reponse et le nom du fichier, et rien
--   de plus.
-- * Stockage — le bucket `support` est repasse en service-role seul par
--   `20260907221109`. Le fichier n'est jamais servi au navigateur : il passe par
--   une URL signee emise cote serveur, qui verifie elle-meme que l'appelant est
--   l'auteur de la demande. Rajouter ici une policy de lecture par prefixe
--   d'etablissement rouvrirait exactement la fuite que cette migration-la a
--   fermee — la piece jointe d'un collegue, le plus souvent une liste d'eleves.
