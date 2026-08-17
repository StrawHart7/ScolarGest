import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Séquence de niveaux Togo, par cycle. `next` réfère au `nom` du niveau suivant
// (même cycle ou cycle supérieur — la résolution est faite en 2e passe).
const CYCLES = [
  { nom: 'MATERNELLE', ordre: 1 },
  { nom: 'PRIMAIRE', ordre: 2 },
  { nom: 'COLLEGE', ordre: 3 },
  { nom: 'LYCEE', ordre: 4 },
] as const;

const NIVEAUX: Array<{ cycle: string; nom: string; ordre: number; next?: string }> = [
  // Maternelle
  { cycle: 'MATERNELLE', nom: 'Petite Section', ordre: 1, next: 'Moyenne Section' },
  { cycle: 'MATERNELLE', nom: 'Moyenne Section', ordre: 2, next: 'Grande Section' },
  { cycle: 'MATERNELLE', nom: 'Grande Section', ordre: 3, next: 'CP1' },
  // Primaire (Togo)
  { cycle: 'PRIMAIRE', nom: 'CP1', ordre: 1, next: 'CP2' },
  { cycle: 'PRIMAIRE', nom: 'CP2', ordre: 2, next: 'CE1' },
  { cycle: 'PRIMAIRE', nom: 'CE1', ordre: 3, next: 'CE2' },
  { cycle: 'PRIMAIRE', nom: 'CE2', ordre: 4, next: 'CM1' },
  { cycle: 'PRIMAIRE', nom: 'CM1', ordre: 5, next: 'CM2' },
  { cycle: 'PRIMAIRE', nom: 'CM2', ordre: 6, next: '6ème' },
  // Collège
  { cycle: 'COLLEGE', nom: '6ème', ordre: 1, next: '5ème' },
  { cycle: 'COLLEGE', nom: '5ème', ordre: 2, next: '4ème' },
  { cycle: 'COLLEGE', nom: '4ème', ordre: 3, next: '3ème' },
  { cycle: 'COLLEGE', nom: '3ème', ordre: 4, next: '2nde' },
  // Lycée
  { cycle: 'LYCEE', nom: '2nde', ordre: 1, next: '1ère' },
  { cycle: 'LYCEE', nom: '1ère', ordre: 2, next: 'Tle' },
  { cycle: 'LYCEE', nom: 'Tle', ordre: 3 },
];

// Séries togolaises couramment utilisées au lycée.
const SERIES_LYCEE = ['A4', 'C', 'D', 'F4', 'G2', 'G3'];

const PLANS = [
  { nom: 'Mensuel', duree: 'MOIS', prix: 25000 },
  { nom: 'Annuel', duree: 'AN', prix: 250000 },
];

async function main() {
  // 1. Cycles
  for (const c of CYCLES) {
    await prisma.cycle.upsert({
      where: { nom: c.nom },
      update: { ordre: c.ordre },
      create: c,
    });
  }
  const cyclesByNom = Object.fromEntries((await prisma.cycle.findMany()).map((c) => [c.nom, c]));

  // 2. Niveaux (sans niveauSuivantId dans un premier temps)
  for (const n of NIVEAUX) {
    const cycle = cyclesByNom[n.cycle];
    if (!cycle) continue;
    await prisma.niveau.upsert({
      where: { cycleId_nom: { cycleId: cycle.id, nom: n.nom } },
      update: { ordre: n.ordre },
      create: { cycleId: cycle.id, nom: n.nom, ordre: n.ordre },
    });
  }
  const allNiveaux = await prisma.niveau.findMany();
  const niveauByNom = new Map(allNiveaux.map((n) => [n.nom, n]));

  // 3. Chaînage niveauSuivantId
  for (const n of NIVEAUX) {
    if (!n.next) continue;
    const current = niveauByNom.get(n.nom);
    const next = niveauByNom.get(n.next);
    if (!current || !next) continue;
    await prisma.niveau.update({
      where: { id: current.id },
      data: { niveauSuivantId: next.id },
    });
  }

  // 4. Séries lycée
  const lycee = cyclesByNom['LYCEE'];
  if (lycee) {
    for (const s of SERIES_LYCEE) {
      await prisma.serie.upsert({
        where: { cycleId_nom: { cycleId: lycee.id, nom: s } },
        update: {},
        create: { cycleId: lycee.id, nom: s },
      });
    }
  }

  // 5. Plans d'abonnement
  for (const p of PLANS) {
    await prisma.planAbonnement.upsert({
      where: { nom: p.nom },
      update: { duree: p.duree, prix: p.prix },
      create: p,
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed: cycles, niveaux, series, plans OK');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
