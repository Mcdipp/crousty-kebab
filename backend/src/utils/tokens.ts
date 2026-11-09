import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** Jeton secret aléatoire (256 bits) encodé en base64url. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Empreinte SHA-256 hexadécimale (64 caractères) — seule valeur stockée en base. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Comparaison en temps constant d'un jeton avec une empreinte stockée. */
export function verifyToken(token: string | undefined, storedHash: string): boolean {
  if (!token) return false;
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Code de session à 4 chiffres (0000–9999), généré de façon cryptographiquement sûre. */
export function randomSessionCode(): string {
  return randomInt(0, 10_000).toString().padStart(4, '0');
}

/** Normalise un nom pour les comparaisons d'unicité. */
export function nameKey(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR');
}
