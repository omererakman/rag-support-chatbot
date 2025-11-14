import { describe, it, expect } from 'vitest';
import { detectPII, redactPII } from '../../../src/safety/pii.js';

describe('PII Detection', () => {
  it('should detect email addresses', () => {
    const result = detectPII('Contact us at test@example.com');
    expect(result.detected).toBe(true);
    expect(result.types.email).toBeDefined();
    expect(result.types.email).toContain('test@example.com');
  });

  it('should detect phone numbers', () => {
    const result = detectPII('Call us at 555-123-4567');
    expect(result.detected).toBe(true);
    expect(result.types.phone).toBeDefined();
  });

  it('should detect SSN', () => {
    const result = detectPII('SSN: 123-45-6789');
    expect(result.detected).toBe(true);
    expect(result.types.ssn).toBeDefined();
  });

  it('should detect credit card numbers', () => {
    const result = detectPII('Card: 1234-5678-9012-3456');
    expect(result.detected).toBe(true);
    expect(result.types.creditCard).toBeDefined();
  });

  it('should not detect PII in clean text', () => {
    const result = detectPII('This is a normal sentence without any PII.');
    expect(result.detected).toBe(false);
    expect(Object.keys(result.types)).toHaveLength(0);
  });

  it('should redact PII', () => {
    const detection = detectPII('Email: test@example.com');
    const redacted = redactPII('Email: test@example.com', detection);
    expect(redacted).toContain('[EMAIL_REDACTED]');
    expect(redacted).not.toContain('test@example.com');
  });
});
