-- Le code sous lequel une école range une matière n'est pas toujours celui du
-- ministère.
--
-- Le programme national nomme la même discipline différemment selon le cycle :
-- « Anglais » au collège devient « Langue Vivante 1 » au lycée, et
-- « Physique-Chimie-Technologie » devient « Physique-Chimie ». Une école, elle,
-- a **une** matière Anglais et **une** matière Physique-Chimie, qu'elle
-- enseigne dans les deux cycles.
--
-- Le rattachement par le seul code officiel (migration `0021`) laissait donc
-- ces deux disciplines sans barème dès qu'une école couvrait les deux cycles :
-- son « ANG » trouvait le collège et manquait le lycée. Le symptôme aurait été
-- discret — deux matières sur dix à saisir à la main, sans qu'on comprenne
-- pourquoi celles-là.
--
-- `codeEcole` est le code que l'école utilise réellement. Il vaut le code
-- officiel dans la grande majorité des cas ; il n'en diffère que là où le
-- ministère change de nom d'un cycle à l'autre.

alter table matiere_officielle add column "codeEcole" text;

update matiere_officielle set "codeEcole" = code where "codeEcole" is null;

-- Les deux seules divergences des documents 2022-2023.
update matiere_officielle mo set "codeEcole" = 'ANG'
from cycle c where c.id = mo."cycleId" and c.nom = 'LYCEE' and mo.code = 'LV1';

update matiere_officielle mo set "codeEcole" = 'PC'
from cycle c where c.id = mo."cycleId" and c.nom = 'COLLEGE' and mo.code = 'PCT';

alter table matiere_officielle alter column "codeEcole" set not null;

-- Une école ne peut ranger qu'une matière sous un code donné : deux matières
-- officielles du même cycle ne doivent pas se disputer le même `codeEcole`,
-- sinon le barème appliqué dépendrait de l'ordre de lecture.
create unique index matiere_officielle_code_ecole_unique
  on matiere_officielle ("cycleId", "codeEcole");
