-- Un seul bulletin en vigueur par eleve et par periode.
--
-- `regenererBulletin` marquait bien l'ancien document OBSOLETE, mais la
-- generation groupee — celle qui traite toute une classe — n'en marquait
-- aucun. Les bulletins s'empilaient donc tous en GENERE, et rien ne disait
-- lequel faisait foi : le telechargement groupe sortait toutes les versions
-- d'un meme eleve dans le meme dossier, avec des noms de fichiers qui ne
-- permettaient pas de les departager.
--
-- Constate en base avant correction : jusqu'a **cinq** documents en GENERE
-- pour un meme eleve sur un meme trimestre.
--
-- La source est corrigee cote service (`genererBulletin` perime desormais les
-- precedents, apres insertion du nouveau). Cette migration rattrape ce qui
-- existe deja.

-- Rattrapage : ne garder en vigueur que le plus recent de chaque
-- (etablissement, eleve, classe, periode). Les autres passent OBSOLETE — leur
-- fichier reste en stockage, l'operation est reversible et respecte
-- l'invariant « pas de suppression dure ».
with classes as (
  select id,
         row_number() over (
           partition by "etablissementId", "objetId", "classeId", periode
           order by "dateGeneration" desc, reference desc, id
         ) as rang
  from document
  where type = 'BULLETIN'
    and statut = 'GENERE'
    -- Les bulletins d'avant la migration 0025 n'ont ni classe ni periode :
    -- rien ne permet de les regrouper, on n'y touche pas.
    and "classeId" is not null
    and periode is not null
)
update document d
set statut = 'OBSOLETE'
from classes c
where d.id = c.id and c.rang > 1;

-- Pas de contrainte d'unicite partielle sur (eleve, classe, periode, GENERE).
--
-- Elle serait techniquement possible et semble tentante, mais elle ferait
-- echouer `genererBulletin` a l'insertion : le service cree le nouveau
-- document **avant** de perimer les precedents, precisement pour qu'un echec
-- du rendu PDF ne laisse pas un eleve sans aucun bulletin en vigueur.
-- Inverser cet ordre pour satisfaire une contrainte echangerait un defaut
-- d'affichage contre une perte de document.
--
-- L'invariant est donc tenu par le service et par la lecture
-- (`src/lib/bulletins.ts`, qui garde le plus recent quoi qu'il arrive), pas
-- par un index.
