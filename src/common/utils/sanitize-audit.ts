const SENSITIVE_KEYS = new Set([
  'password',
  'oldPassword',
  'newPassword',
  'adminPassword',
  'refreshToken',
  'token',
]);

export function sanitizeForAudit(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeForAudit);
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEYS.has(key)
        ? '[REDACTED]'
        : sanitizeForAudit(val);
    }
    return result;
  }

  return value;
}
