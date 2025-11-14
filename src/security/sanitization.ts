export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  const maxLength = 10000;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

export function validateInput(input: unknown): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  const sanitized = sanitizeInput(input);

  if (sanitized.length === 0) {
    throw new Error('Input cannot be empty');
  }

  return sanitized;
}
