const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  passport: /\b[A-Z]{1,2}\d{6,9}\b/g,
  driverLicense: /\b[A-Z]{1,2}\d{5,8}\b/g,
  zipCode: /\b\d{5}(?:-\d{4})?\b/g,
  dateOfBirth: /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:19|20)\d{2}\b/g,
  apiKey: /\b(?:api[_-]?key|apikey|access[_-]?token)[:\s=]+[\w-]+/gi,
  accountNumber: /\b(?:account|acct)[#:\s]+\d{6,}\b/gi,
};

export function detectPII(text: string): {
  detected: boolean;
  types: Record<string, string[]>;
} {
  const detectedPII: Record<string, string[]> = {};
  let hasPII = false;

  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      detectedPII[type] = matches;
      hasPII = true;
    }
  }

  return {
    detected: hasPII,
    types: detectedPII,
  };
}

export function redactPII(text: string, detection: { types: Record<string, string[]> }): string {
  let redacted = text;
  for (const [type, matches] of Object.entries(detection.types)) {
    for (const match of matches) {
      redacted = redacted.replace(match, `[${type.toUpperCase()}_REDACTED]`);
    }
  }
  return redacted;
}
