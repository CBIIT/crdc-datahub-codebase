const SECRET_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  // key=value / "key": "value" style secrets
  {
    pattern:
      /((?:password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|client[_-]?secret|session[_-]?secret|otp[_-]?secret|authorization|auth[_-]?token|private[_-]?key)["']?\s*[:=]\s*["']?)([^\s"',;&)]+)/gi,
    replacement: '$1[REDACTED]',
  },
  // Bearer / Basic authorization headers
  { pattern: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, replacement: '$1 [REDACTED]' },
  // JWTs
  {
    pattern: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g,
    replacement: '[REDACTED_JWT]',
  },
  // AWS access key ids
  { pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, replacement: '[REDACTED_AWS_KEY]' },
  // Query-string credentials
  {
    pattern: /([?&](?:password|token|access_token|id_token|code|api_key|key|secret)=)[^&\s]+/gi,
    replacement: '$1[REDACTED]',
  },
  // URL userinfo
  { pattern: /(\b[a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi, replacement: '$1[REDACTED]@' },
  // Email addresses
  { pattern: /\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, replacement: '[REDACTED_EMAIL]' },
];

/** Values supplied through the environment that must never reach the document. */
const SENSITIVE_ENV_VARS = [
  'LOGIN_GOV_EMAIL',
  'LOGIN_GOV_PASSWORD',
  'LOGIN_GOV_OTP_SECRET',
];

export function redact(input: string | undefined | null): string {
  if (!input) {
    return '';
  }

  let output = input;

  for (const name of SENSITIVE_ENV_VARS) {
    const value = process.env[name];
    if (value && value.length >= 4) {
      output = output.split(value).join('[REDACTED]');
    }
  }

  for (const { pattern, replacement } of SECRET_PATTERNS) {
    output = output.replace(pattern, replacement);
  }

  return output;
}
