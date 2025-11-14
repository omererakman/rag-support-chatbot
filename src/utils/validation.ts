import { validateInput } from '../security/sanitization.js';

export function validateStringInput(input: unknown): string {
  return validateInput(input);
}

export function validatePositiveNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || isNaN(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}
