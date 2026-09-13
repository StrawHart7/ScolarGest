import { describe, it, expect, vi } from 'vitest';
import { reessayerLecture } from '../reessayer';

/** Fabrique une lecture qui échoue les `echecs` premières fois, puis réussit. */
function lectureQuiEchoue(echecs: number) {
  let appels = 0;
  const lecture = async () => {
    appels += 1;
    return appels <= echecs
      ? { data: null, error: { message: 'canceling statement due to statement timeout' } }
      : { data: 'ok', error: null };
  };
  return { lecture, appels: () => appels };
}

describe('reprise d’une lecture', () => {
  it('n’appelle qu’une fois quand ça passe du premier coup', async () => {
    const { lecture, appels } = lectureQuiEchoue(0);
    const r = await reessayerLecture(lecture);
    expect(appels()).toBe(1);
    expect(r.data).toBe('ok');
    expect(r.reprise).toBe(false);
  });

  it('rejoue une fois et rend le second résultat', async () => {
    const { lecture, appels } = lectureQuiEchoue(1);
    const r = await reessayerLecture(lecture);
    expect(appels()).toBe(2);
    expect(r.data).toBe('ok');
    expect(r.error).toBeNull();
    expect(r.reprise).toBe(true);
  });

  /**
   * Une seule reprise. Si la base est réellement en panne, marteler ne la
   * répare pas : le deuxième échec est une information, pas un cas à réessayer.
   * Sans ce contrôle, une boucle de reprise sur le middleware tiendrait la
   * requête ouverte pendant toute la durée de l'incident.
   */
  it('ne rejoue pas indéfiniment, et rend l’erreur du second essai', async () => {
    const { lecture, appels } = lectureQuiEchoue(99);
    const r = await reessayerLecture(lecture);
    expect(appels()).toBe(2);
    expect(r.error).not.toBeNull();
    expect(r.reprise).toBe(true);
  });

  it('laisse remonter une exception plutôt que de la traiter comme un refus', async () => {
    // Une lecture qui **lève** n'est pas une lecture qui rend `error` : c'est
    // un défaut de code, et l'avaler ici le rendrait indiagnosticable.
    await expect(
      reessayerLecture(async () => {
        throw new Error('client mal construit');
      }),
    ).rejects.toThrow('client mal construit');
  });

  it('attend entre les deux essais, sans que ça se voie', async () => {
    vi.useFakeTimers();
    try {
      const { lecture, appels } = lectureQuiEchoue(1);
      const promesse = reessayerLecture(lecture);
      await vi.advanceTimersByTimeAsync(200);
      await promesse;
      // Deux appels, donc l'attente n'a pas empêché la reprise.
      expect(appels()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
