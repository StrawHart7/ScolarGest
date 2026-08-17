import bcrypt from 'bcrypt';

const ROUNDS = 12;
const PIN_REGEX = /^\d{6}$/;

export async function hashPin(pin: string): Promise<string> {
  if (!PIN_REGEX.test(pin)) throw new Error('Le PIN doit contenir exactement 6 chiffres');
  return bcrypt.hash(pin, ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!PIN_REGEX.test(pin)) return false;
  return bcrypt.compare(pin, hash);
}
