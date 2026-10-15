import { AuthResponse, User } from '../models/user.model';

/**
 * Connexion sans internet : après une connexion en ligne réussie, on garde sur l'appareil une empreinte
 * du mot de passe (PBKDF2, 150 000 itérations, sel aléatoire — jamais le mot de passe lui-même), le profil
 * et les jetons. Hors connexion, la même saisie redonne accès à l'application et aux cours de l'appareil.
 */
const KEY = 'itecom-offline-auth';            // préfixe « itecom-offline » : conservé par AuthService.clearSession
const ITERATIONS = 150_000;
/** Au-delà, il faut se reconnecter une fois avec internet. */
export const OFFLINE_LOGIN_MAX_DAYS = 30;

interface OfflineAccount {
  salt: string;
  hash: string;
  user: User;
  accessToken: string;
  refreshToken: string;
  onlineAt: number;   // dernière connexion en ligne
}

type Accounts = Record<string, OfflineAccount>;

function read(): Accounts {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

function write(accounts: Accounts) {
  try { localStorage.setItem(KEY, JSON.stringify(accounts)); } catch { /* stockage plein ou bloqué */ }
}

const b64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return b64(bits);
}

export const offlineAuthSupported = typeof crypto !== 'undefined' && !!crypto.subtle;

/** Après une connexion en ligne réussie. */
export async function rememberAccount(email: string, password: string, resp: AuthResponse) {
  if (!offlineAuthSupported) return;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  const accounts = read();
  accounts[email.trim().toLowerCase()] = {
    salt: b64(salt), hash, user: resp.user, accessToken: resp.accessToken, refreshToken: resp.refreshToken, onlineAt: Date.now()
  };
  write(accounts);
}

/** Session renouvelée en ligne : on garde les derniers jetons pour la prochaine connexion hors ligne. */
export function updateAccountSession(resp: AuthResponse) {
  const accounts = read();
  const a = accounts[resp.user.email.toLowerCase()];
  if (!a) return;
  accounts[resp.user.email.toLowerCase()] = { ...a, user: resp.user, accessToken: resp.accessToken, refreshToken: resp.refreshToken, onlineAt: Date.now() };
  write(accounts);
}

/** Vérifie la saisie hors connexion ; renvoie la session gardée ou une erreur claire. */
export async function verifyOffline(email: string, password: string): Promise<AuthResponse> {
  const a = read()[email.trim().toLowerCase()];
  if (!a || !offlineAuthSupported) {
    throw new Error('Hors connexion : ce compte ne s\'est jamais connecté sur cet appareil. Connectez-vous une première fois avec internet.');
  }
  if (Date.now() - a.onlineAt > OFFLINE_LOGIN_MAX_DAYS * 86_400_000) {
    throw new Error(`Hors connexion : votre dernière connexion avec internet date de plus de ${OFFLINE_LOGIN_MAX_DAYS} jours. Reconnectez-vous avec internet.`);
  }
  if (await derive(password, unb64(a.salt)) !== a.hash) {
    throw new Error('Email ou mot de passe incorrect.');
  }
  return { accessToken: a.accessToken, refreshToken: a.refreshToken, tokenType: 'Bearer', user: a.user };
}

/** Appareil partagé : on oublie les comptes gardés pour la connexion hors ligne. */
export function forgetAccounts() {
  try { localStorage.removeItem(KEY); } catch { }
}
