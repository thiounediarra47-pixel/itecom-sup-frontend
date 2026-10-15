import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Contrôle des emails et téléphones saisis — mêmes règles que le serveur (ContactValidator.java),
 * qui vérifie en plus que le domaine de l'email existe.
 */

const LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD = /^[a-z]{2,24}$/;

const DOMAIN_TYPOS: Record<string, string> = {
  'gmal.com': 'gmail.com', 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com',
  'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.om': 'gmail.com',
  'gmail.fr': 'gmail.com', 'gmail.sn': 'gmail.com', 'gmaill.com': 'gmail.com', 'gmail.cmo': 'gmail.com',
  'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'hotmail.co': 'hotmail.com',
  'yaho.fr': 'yahoo.fr', 'yahou.fr': 'yahoo.fr', 'yahoo.con': 'yahoo.com', 'yahoo.co': 'yahoo.com',
  'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'iclod.com': 'icloud.com', 'icloud.con': 'icloud.com'
};

/** Message d'erreur, ou null si l'email est valide. */
export function emailError(value: string | null | undefined): string | null {
  const email = (value ?? '').trim().toLowerCase();
  if (!email) return 'Indiquez l\'adresse email.';
  const at = email.lastIndexOf('@');
  const invalid = `Adresse email invalide (exemple : prenom.nom@gmail.com).`;
  if (email.length > 254 || at <= 0 || at !== email.indexOf('@')) return invalid;
  const local = email.substring(0, at), domain = email.substring(at + 1);
  const labels = domain.split('.');
  if (local.length > 64 || !LOCAL.test(local) || labels.length < 2) return invalid;
  if (!labels.every((l, i) => i === labels.length - 1 ? TLD.test(l) : LABEL.test(l))) return invalid;
  const fix = DOMAIN_TYPOS[domain];
  return fix ? `Adresse email incorrecte : vouliez-vous dire ${local}@${fix} ?` : null;
}

/** ANY : tout numéro (sénégalais ou international) ; MOBILE : portable sénégalais ; ORANGE_MONEY / FREE_MONEY : opérateur. */
export type PhoneUsage = 'ANY' | 'MOBILE' | 'ORANGE_MONEY' | 'FREE_MONEY';

export function phoneUsageFor(paymentMethod: string | null | undefined): PhoneUsage {
  return paymentMethod === 'ORANGE_MONEY' ? 'ORANGE_MONEY' : paymentMethod === 'FREE_MONEY' ? 'FREE_MONEY' : 'MOBILE';
}

/** Message d'erreur, ou null si le numéro est valide. */
export function phoneError(value: string | null | undefined, usage: PhoneUsage = 'ANY'): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return 'Indiquez le numéro de téléphone.';
  let compact = raw.replace(/[\s.()\-]/g, '');
  if (compact.startsWith('00')) compact = '+' + compact.substring(2);
  if (!/^\+?\d+$/.test(compact)) return 'Numéro invalide : seuls les chiffres sont acceptés (exemple : 77 123 45 67).';
  let national: string;
  if (compact.startsWith('+221')) national = compact.substring(4);
  else if (compact.startsWith('221') && compact.length === 12) national = compact.substring(3);
  else if (compact.startsWith('+')) {
    if (usage !== 'ANY') return 'Le paiement mobile exige un numéro sénégalais (exemple : 77 123 45 67).';
    return /^\+[1-9]\d{7,14}$/.test(compact) ? null : 'Numéro international invalide (exemple : +33 6 12 34 56 78).';
  } else national = compact;
  if (national.length !== 9) return 'Un numéro sénégalais a 9 chiffres (exemple : 77 123 45 67).';
  const prefix = national.substring(0, 2);
  const mobile = /^7[05678]$/.test(prefix), landline = /^3[03]$/.test(prefix);
  if (!mobile && !landline) return 'Le numéro doit commencer par 70, 75, 76, 77, 78 (mobile) ou 33 (fixe).';
  if (usage !== 'ANY' && !mobile) return 'Le paiement mobile exige un numéro de portable (70, 75, 76, 77 ou 78).';
  if (usage === 'ORANGE_MONEY' && !/^7[78]$/.test(prefix)) return 'Un numéro Orange Money commence par 77 ou 78.';
  if (usage === 'FREE_MONEY' && prefix !== '76') return 'Un numéro Free Money commence par 76.';
  if (new Set(national.substring(2)).size === 1) return 'Ce numéro de téléphone n\'est pas un vrai numéro.';
  return null;
}

/** Validateurs de formulaire réactif (message dans errors.contact). */
export function emailValidator(): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const msg = c.value ? emailError(c.value) : null;
    return msg ? { contact: msg } : null;
  };
}

export function phoneValidator(usage: PhoneUsage = 'ANY'): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const msg = c.value ? phoneError(c.value, usage) : null;   // champ facultatif : vide accepté
    return msg ? { contact: msg } : null;
  };
}
