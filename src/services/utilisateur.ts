import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Role } from './tenant';
import { getTenantContext } from './tenant';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { hashPin, exigerPin } from './pin';
import { urlApplication } from '@/lib/url-app';
import {
  emailDepuisIdentifiant,
  identifiantValide,
  motDePasseProvisoire,
  normaliserIdentifiant,
} from '@/lib/identifiants';

export interface Utilisateur {
  id: string;
  etablissementId: string | null;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  role: Role;
  statut: 'ACTIF' | 'INACTIF' | 'BLOQUE';
  dernierAcces: string | null;
  createdAt: string;
}

export interface InviteUtilisateurInput {
  email: string;
  nom: string;
  prenom: string;
  role: Role;
  etablissementId: string | null;
}

/**
 * Provisions a Supabase Auth user (invitation email), stamps the tenant claims
 * in app_metadata (picked up by the Auth Hook at token issue), and inserts the
 * matching `utilisateur` row. SUPER_ADMIN may invite a DIRECTEUR (or itself);
 * DIRECTEUR may invite SECRETAIRE/COMPTABLE/ENSEIGNANT for its own école.
 */
export async function inviteUtilisateur(input: InviteUtilisateurInput): Promise<Utilisateur> {
  if (input.role === 'DIRECTEUR' || input.role === 'SUPER_ADMIN') {
    await requireRole();
  } else {
    const ctx = await requireRole('DIRECTEUR');
    if (input.etablissementId !== ctx.etablissementId) {
      throw new Error('Accès refusé: établissement différent');
    }
  }

  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    input.email,
    {
      data: {},
      // L'invite n'a pas encore de mot de passe : le callback l'enverra sur
      // `/update-password`, deduit du `type=invite` du lien. Sans cela il
      // arriverait sur le tableau de bord avec une session valide mais aucun
      // moyen de se reconnecter le lendemain.
      redirectTo: `${urlApplication()}/auth/callback`,
    },
  );
  if (inviteError || !invited.user) {
    throw new Error(inviteError?.message ?? "Échec de l'invitation");
  }

  const { error: metaError } = await admin.auth.admin.updateUserById(invited.user.id, {
    app_metadata: {
      etablissement_id: input.etablissementId,
      role: input.role,
    },
  });
  if (metaError) throw metaError;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('utilisateur')
    .insert({
      id: invited.user.id,
      etablissementId: input.etablissementId,
      nom: input.nom,
      prenom: input.prenom,
      email: input.email,
      role: input.role,
    })
    .select(
      'id, "etablissementId", nom, prenom, email, telephone, role, statut, "dernierAcces", "createdAt"',
    )
    .single();
  if (error) throw error;

  await auditLog({
    action: 'INVITE_UTILISATEUR',
    module: 'identity',
    objetType: 'Utilisateur',
    objetId: data.id,
    nouvelleValeur: { email: input.email, role: input.role, etablissementId: input.etablissementId },
  });

  return data;
}

export interface CreerCompteSansEmailInput {
  identifiant: string;
  nom: string;
  prenom: string;
  role: Role;
  etablissementId: string | null;
}

export interface CompteSansEmailCree {
  utilisateur: Utilisateur;
  identifiant: string;
  /** Montré **une seule fois**, jamais relu, jamais journalisé. */
  motDePasseProvisoire: string;
}

/**
 * Crée un compte qui se connecte par identifiant et mot de passe, sans adresse
 * email.
 *
 * C'est la seule façon d'ouvrir la plateforme à la majorité des enseignants
 * togolais : l'invitation par courrier électronique suppose une boîte mail que
 * beaucoup n'ont pas, ou ne savent pas ouvrir. Le directeur crée le compte, lit
 * le mot de passe provisoire à l'écran, le recopie sur un papier et le remet de
 * la main à la main. Aucune attente, aucun lien, aucun message perdu.
 *
 * Voir `src/lib/identifiants.ts` pour le mécanisme — il n'y a **ni colonne ni
 * migration** : l'identifiant est l'adresse interne privée de son domaine, et
 * l'unicité est déjà tenue par `auth.users.email`.
 *
 * ## Le compte Auth est défait si l'insertion échoue
 *
 * `inviteUtilisateur` ne le fait pas, et laisse un compte Auth orphelin quand
 * l'insertion dans `utilisateur` tombe. Ici c'est pire qu'une ligne perdue :
 * l'identifiant resterait **pris** par un compte que plus rien ne référence, et
 * le directeur qui recommence recevrait « cet identifiant est déjà utilisé »
 * sans jamais pouvoir le libérer.
 */
export async function creerCompteSansEmail(
  input: CreerCompteSansEmailInput,
): Promise<CompteSansEmailCree> {
  if (input.role === 'DIRECTEUR' || input.role === 'SUPER_ADMIN') {
    await requireRole();
  } else {
    const ctx = await requireRole('DIRECTEUR');
    if (input.etablissementId !== ctx.etablissementId) {
      throw new Error('Accès refusé: établissement différent');
    }
  }

  if (!identifiantValide(input.identifiant)) {
    throw new Error(
      "L'identifiant doit faire au moins trois caractères et contenir une lettre ou un chiffre.",
    );
  }

  const identifiant = normaliserIdentifiant(input.identifiant);
  const email = emailDepuisIdentifiant(identifiant);
  const motDePasse = motDePasseProvisoire();

  const admin = createAdminClient();
  const { data: cree, error: erreurAuth } = await admin.auth.admin.createUser({
    email,
    password: motDePasse,
    // Aucun courrier n'est envoyé : le domaine n'en reçoit pas, et le compte
    // doit être utilisable dans la minute.
    email_confirm: true,
    app_metadata: {
      etablissement_id: input.etablissementId,
      role: input.role,
      // Le mot de passe a été tiré par la plateforme et a circulé sur un bout
      // de papier : il sera exigé d'en choisir un autre à la première
      // connexion. Le marqueur vit dans le jeton, le middleware le lit sans
      // requête.
      [CLAIM_MOT_DE_PASSE_PROVISOIRE]: true,
    },
  });
  if (erreurAuth || !cree.user) {
    // Supabase répond « already been registered » sur l'adresse interne. Dit
    // tel quel, ce message parlerait d'une adresse que le directeur n'a jamais
    // saisie et ne connaît pas.
    const message = erreurAuth?.message ?? '';
    if (/already|registered|exists/i.test(message)) {
      throw new Error(`L'identifiant « ${identifiant} » est déjà utilisé. Choisissez-en un autre.`);
    }
    throw new Error(message || 'Échec de la création du compte');
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('utilisateur')
    .insert({
      id: cree.user.id,
      etablissementId: input.etablissementId,
      nom: input.nom,
      prenom: input.prenom,
      email,
      role: input.role,
    })
    .select(
      'id, "etablissementId", nom, prenom, email, telephone, role, statut, "dernierAcces", "createdAt"',
    )
    .single();
  if (error) {
    await admin.auth.admin.deleteUser(cree.user.id);
    throw error;
  }

  await auditLog({
    action: 'CREER_COMPTE_IDENTIFIANT',
    module: 'identity',
    objetType: 'Utilisateur',
    objetId: data.id,
    // Le mot de passe n'entre pas dans le journal : il est distribué sur
    // papier, et un journal d'audit se relit.
    nouvelleValeur: { identifiant, role: input.role, etablissementId: input.etablissementId },
  });

  return { utilisateur: data, identifiant, motDePasseProvisoire: motDePasse };
}

/**
 * Redonne un mot de passe provisoire à un compte de l'établissement.
 *
 * **C'est la contrepartie du compte sans adresse**, et il faut la voir en face :
 * sans email, il n'y a pas de « mot de passe oublié » en libre-service. Le
 * directeur devient le mécanisme de réinitialisation de son école.
 *
 * D'où le PIN : redonner un mot de passe, c'est ouvrir un compte qui touche aux
 * notes et à l'argent. Le step-up est la même barrière que pour l'approbation
 * des notes ou la clôture d'une année.
 */
export async function reinitialiserMotDePasse(
  utilisateurId: string,
  pin: string,
): Promise<string> {
  const ctx = await requireRole('DIRECTEUR');
  await exigerPin(pin, 'DIRECTEUR');

  // La cible doit appartenir à l'établissement de l'appelant, et ne peut pas
  // être un SUPER_ADMIN : `listUtilisateurs` les exclut déjà de l'écran, mais
  // l'identifiant arrive de l'appelant et un écran ne décide de rien.
  const supabase = createClient();
  const { data: cible, error: erreurCible } = await supabase
    .from('utilisateur')
    .select('id, email, role')
    .eq('id', utilisateurId)
    .eq('etablissementId', ctx.etablissementId)
    .neq('role', 'SUPER_ADMIN')
    .maybeSingle();
  if (erreurCible) throw erreurCible;
  if (!cible) throw new Error('Utilisateur introuvable dans votre établissement.');

  const motDePasse = motDePasseProvisoire();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(utilisateurId, {
    password: motDePasse,
    // Remis, comme à la création : ce mot de passe-ci a aussi transité par un
    // papier, il ne doit pas rester en place.
    app_metadata: { [CLAIM_MOT_DE_PASSE_PROVISOIRE]: true },
  });
  if (error) throw error;

  await auditLog({
    action: 'REINITIALISER_MOT_DE_PASSE',
    module: 'identity',
    objetType: 'Utilisateur',
    objetId: utilisateurId,
    nouvelleValeur: { role: (cible as { role: string }).role },
  });

  return motDePasse;
}

/**
 * Marqueur « ce mot de passe a été tiré par la plateforme, il doit être
 * changé ». Vit dans `app_metadata`, donc dans le JWT : le middleware le lit
 * sans requête, et **l'utilisateur ne peut pas l'effacer lui-même** —
 * `app_metadata` n'est écrivable que par la clé de service, contrairement à
 * `user_metadata`.
 */
export const CLAIM_MOT_DE_PASSE_PROVISOIRE = 'mot_de_passe_provisoire';

/**
 * Change son propre mot de passe.
 *
 * **Ça n'existait pas.** Le bouton « Modifier » de `/profil` renvoyait vers
 * `/forgot-password`, qui envoie un lien par courrier électronique. Pour un
 * compte sans adresse — ceux qu'on vient d'ouvrir pour les enseignants — ce
 * courrier part vers un domaine qui n'en reçoit aucun : la personne gardait à
 * vie le mot de passe tiré par la plateforme, celui qui a circulé sur un bout
 * de papier.
 *
 * L'ancien mot de passe est exigé et **vérifié par une vraie connexion**.
 * `auth.updateUser` ne le demande pas : une session laissée ouverte sur un
 * poste partagé — l'ordinaire d'une salle des professeurs — suffirait sinon à
 * prendre le compte.
 */
export async function changerMotDePasse(
  ancienMotDePasse: string,
  nouveauMotDePasse: string,
): Promise<void> {
  const ctx = await getTenantContext();
  if (nouveauMotDePasse.length < 8) {
    throw new Error('Le nouveau mot de passe doit faire au moins 8 caractères.');
  }
  if (nouveauMotDePasse === ancienMotDePasse) {
    throw new Error('Le nouveau mot de passe doit être différent de l’ancien.');
  }

  const supabase = createClient();
  const { data: profil, error: erreurProfil } = await supabase
    .from('utilisateur')
    .select('email')
    .eq('id', ctx.userId)
    .single();
  if (erreurProfil) throw erreurProfil;

  const { error: erreurVerif } = await supabase.auth.signInWithPassword({
    email: (profil as { email: string }).email,
    password: ancienMotDePasse,
  });
  if (erreurVerif) {
    throw new Error('Mot de passe actuel incorrect.');
  }

  const { error } = await supabase.auth.updateUser({ password: nouveauMotDePasse });
  if (error) throw new Error(error.message);

  // Le marqueur est retiré **en écrasant l'objet entier**, role et
  // établissement relus puis réécrits : `updateUserById` fusionne, mais s'en
  // remettre à la fusion pour un objet qui porte le rôle et le tenant, c'est
  // jouer l'isolation de l'école sur une subtilité d'API.
  const admin = createAdminClient();
  const { data: compte } = await admin.auth.admin.getUserById(ctx.userId);
  const metadonnees = { ...(compte?.user?.app_metadata ?? {}) } as Record<string, unknown>;
  if (metadonnees[CLAIM_MOT_DE_PASSE_PROVISOIRE]) {
    delete metadonnees[CLAIM_MOT_DE_PASSE_PROVISOIRE];
    await admin.auth.admin.updateUserById(ctx.userId, {
      app_metadata: { ...metadonnees, [CLAIM_MOT_DE_PASSE_PROVISOIRE]: null },
    });
    // Sans ce rafraîchissement, le jeton en cours porte encore le marqueur : le
    // middleware renverrait l'utilisateur sur l'écran qu'il vient de quitter,
    // en boucle, jusqu'à expiration — une heure.
    await supabase.auth.refreshSession();
  }

  await auditLog({
    action: 'CHANGER_MOT_DE_PASSE',
    module: 'identity',
    objetType: 'Utilisateur',
    objetId: ctx.userId,
  });
}

export async function listUtilisateurs(): Promise<Utilisateur[]> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('utilisateur')
    .select(
      'id, "etablissementId", nom, prenom, email, telephone, role, statut, "dernierAcces", "createdAt"',
    )
    .eq('etablissementId', ctx.etablissementId)
    .neq('role', 'SUPER_ADMIN')
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getUtilisateur(id: string): Promise<Utilisateur> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('utilisateur')
    .select(
      'id, "etablissementId", nom, prenom, email, telephone, role, statut, "dernierAcces", "createdAt"',
    )
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId)
    .single();
  if (error) throw error;
  return data;
}

export async function listUtilisateursParEtablissement(
  etablissementId: string,
): Promise<Utilisateur[]> {
  await requireRole();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('utilisateur')
    .select(
      'id, "etablissementId", nom, prenom, email, telephone, role, statut, "dernierAcces", "createdAt"',
    )
    .eq('etablissementId', etablissementId)
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Banni cent ans. Supabase attend une duree, pas un booleen ; `'none'` la leve.
 *
 * Un bannissement interdit la connexion **et le renouvellement du jeton**.
 * C'est ce second effet qui compte : sans lui, une session ouverte se
 * prolongerait indefiniment.
 */
const BANNISSEMENT = '876000h';

/**
 * Retire l'acces d'un compte, pour de vrai.
 *
 * ## Ce que cette fonction ne faisait pas
 *
 * Elle ecrivait `statut = 'INACTIF'` et s'arretait la. Or **rien ne lit cette
 * colonne** : ni `requireRole`, qui travaille sur les seuls claims du JWT, ni
 * le middleware, qui ne regarde que l'abonnement. Aucun bannissement, aucune
 * revocation, les claims `app_metadata` intacts.
 *
 * Une secretaire renvoyee gardait donc un acces complet aux dossiers d'eleves
 * et aux factures, aussi longtemps que sa session se renouvelait. Constate le
 * 2026-09-11, et c'est le defaut de securite le plus probable du produit : un
 * depart de personnel est routinier, ouvrir les outils de developpeur ne l'est
 * pas.
 *
 * ## L'ordre des deux ecritures n'est pas indifferent
 *
 * Le bannissement **d'abord**, le statut ensuite. Les deux peuvent echouer, et
 * les deux echecs ne se valent pas : un compte banni encore affiche « Actif »
 * desoriente, un compte affiche « Inactif » qui conserve son acces est
 * exactement le defaut qu'on corrige. On garde donc le risque du premier.
 *
 * ## La fenetre qui reste
 *
 * Le bannissement interdit la connexion et le renouvellement, il ne detruit pas
 * le jeton d'acces deja emis : celui-ci reste valable jusqu'a son expiration,
 * une heure par defaut. L'API d'administration de Supabase n'expose pas de
 * revocation immediate des sessions d'un utilisateur. Cette heure est connue et
 * assumee, pas ignoree — et elle n'a aucun rapport avec l'acces illimite
 * d'avant.
 */
export async function desactiverUtilisateur(utilisateurId: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR');

  // Se desactiver soi-meme etait sans consequence tant que la desactivation
  // n'avait aucun effet. Maintenant qu'elle en a, un Directeur seul de son
  // ecole s'enfermerait dehors sans recours : personne d'autre n'a le droit de
  // le reactiver.
  if (utilisateurId === ctx.userId) {
    throw new Error('Vous ne pouvez pas désactiver votre propre compte.');
  }

  const supabase = createClient();

  // L'appartenance est verifiee **avant** le bannissement : la cle service-role
  // ne connait pas de tenant, et bannir sur un identifiant arbitraire
  // reviendrait a laisser une ecole couper l'acces d'une autre.
  const { data: cible, error: erreurCible } = await supabase
    .from('utilisateur')
    .select('id')
    .eq('id', utilisateurId)
    .eq('etablissementId', ctx.etablissementId)
    .maybeSingle();
  if (erreurCible) throw erreurCible;
  if (!cible) throw new Error('Utilisateur introuvable dans votre établissement.');

  const admin = createAdminClient();
  const { error: erreurBan } = await admin.auth.admin.updateUserById(utilisateurId, {
    ban_duration: BANNISSEMENT,
  });
  if (erreurBan) throw erreurBan;

  const { error } = await supabase
    .from('utilisateur')
    .update({ statut: 'INACTIF' })
    .eq('id', utilisateurId)
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'DESACTIVER_UTILISATEUR',
    module: 'identity',
    objetType: 'Utilisateur',
    objetId: utilisateurId,
  });
}

/**
 * Rend l'acces a un compte desactive.
 *
 * Elle existe **parce que** la desactivation est devenue effective. Sans elle,
 * un clic de trop sur « Desactiver » serait une porte a sens unique : le
 * bannissement Auth ne se leve pas depuis le produit, et une ecole resterait
 * avec une secretaire definitivement dehors pour une erreur de ligne dans un
 * tableau.
 *
 * Ordre inverse de la desactivation, pour la meme raison : le statut d'abord,
 * le bannissement ensuite. Si le second echoue, le compte est affiche « Actif »
 * sans pouvoir entrer — genant et visible — plutot que l'inverse.
 */
export async function reactiverUtilisateur(utilisateurId: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();

  const { data: cible, error: erreurCible } = await supabase
    .from('utilisateur')
    .select('id')
    .eq('id', utilisateurId)
    .eq('etablissementId', ctx.etablissementId)
    .maybeSingle();
  if (erreurCible) throw erreurCible;
  if (!cible) throw new Error('Utilisateur introuvable dans votre établissement.');

  const { error } = await supabase
    .from('utilisateur')
    .update({ statut: 'ACTIF' })
    .eq('id', utilisateurId)
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  const admin = createAdminClient();
  const { error: erreurBan } = await admin.auth.admin.updateUserById(utilisateurId, {
    ban_duration: 'none',
  });
  if (erreurBan) throw erreurBan;

  await auditLog({
    action: 'REACTIVER_UTILISATEUR',
    module: 'identity',
    objetType: 'Utilisateur',
    objetId: utilisateurId,
  });
}

export interface MonProfil {
  nom: string;
  prenom: string;
  email: string;
  role: Role;
  pinConfigure: boolean;
}

export async function getMonProfil(): Promise<MonProfil> {
  const ctx = await getTenantContext();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('utilisateur')
    .select('nom, prenom, email, role, "pinApprobationHash"')
    .eq('id', ctx.userId)
    .single();
  if (error) throw error;

  return {
    nom: data.nom,
    prenom: data.prenom,
    email: data.email,
    role: data.role,
    pinConfigure: Boolean(data.pinApprobationHash),
  };
}

/**
 * Définit ou remplace le PIN de confirmation de l'utilisateur courant.
 * Réservé aux rôles qui en ont l'usage — la Secrétaire approuve les notes, le
 * Directeur passe outre sur une année TERMINEE. Voir doc 03.
 *
 * ## L'ancien PIN est exigé dès qu'il en existe un
 *
 * Le PIN est le second facteur des actions irréversibles : approuver des notes,
 * activer une année, clôturer un cycle. Or il était **remplaçable sans le
 * connaître**, par la session même qu'il est censé protéger. Une session
 * détournée — poste partagé, jeton encore valide après un départ — pouvait donc
 * se donner un nouveau PIN et franchir tout ce que le PIN garde. Le facteur ne
 * protégeait rien contre la seule menace qui le justifie.
 *
 * ## La règle vit dans le service, pas dans l'écran
 *
 * Masquer le champ « PIN actuel » dans le formulaire n'empêcherait pas un appel
 * forgé de l'omettre — même raisonnement que pour `activerCycle` et les gardes
 * de rôle : la liste informe, l'écriture décide. C'est donc la présence d'un
 * hash en base qui déclenche l'exigence, et rien d'autre.
 *
 * ## La vérification est déléguée à `exigerPin`
 *
 * Réécrire la comparaison ici ferait exister deux chemins de vérification du
 * même secret, qui divergeraient au premier ajustement — une limitation de
 * tentatives, par exemple. `exigerPin` lit le hash de l'appelant et lève : le
 * comportement reste identique à celui de toutes les autres actions sensibles.
 */
export async function definirPin(pin: string, ancienPin?: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const { data: compte, error: erreurCompte } = await supabase
    .from('utilisateur')
    .select('"pinApprobationHash"')
    .eq('id', ctx.userId)
    .single();
  if (erreurCompte) throw erreurCompte;

  const dejaConfigure = Boolean(compte.pinApprobationHash);
  if (dejaConfigure) {
    if (!ancienPin) {
      throw new Error('Saisissez votre PIN actuel pour en définir un nouveau.');
    }
    await exigerPin(ancienPin, 'DIRECTEUR', 'SECRETAIRE');
  }

  const hash = await hashPin(pin);
  const { error } = await supabase
    .from('utilisateur')
    .update({ pinApprobationHash: hash })
    .eq('id', ctx.userId);
  if (error) throw error;

  // Deux actions distinctes au journal : une première définition est un geste
  // de configuration, un remplacement est un geste de sécurité. Les confondre
  // rendrait illisible la relecture d'un incident.
  await auditLog({
    action: dejaConfigure ? 'MODIFIER_PIN' : 'DEFINIR_PIN',
    module: 'identity',
    objetType: 'Utilisateur',
    objetId: ctx.userId,
  });
}
