/**
 * Comprehensive safety validation rules for customer Name and Email on BooyahPay.
 * 
 * Features:
 * 1. Exact and Substring Keyword Matching (Govt, Law Enforcement, Legal, Payment Gateways, Fraud/Scam)
 * 2. Levenshtein Distance / Fuzzy Typo Detection (catches variations like 'cost free', 'cashefree', 'razorpey', 'polise', 'sarkari', etc.)
 * 3. Government / Institutional / Agency Email Domain Block (e.g., .gov.*, .nic.*, .mil.*, etc.)
 * 4. Strict Personal Email Whitelist (only @gmail.com, @yahoo.com, @yahoo.co.in, @hotmail.com, @outlook.com, @icloud.com)
 */

// Target sensitive terms to guard against exact, substring, or typo variations
export const SENSITIVE_TERMS = [
  // Payment Gateways & Banking
  'cashfree',
  'razorpay',
  'paytm',
  'phonepe',
  'payu',
  'billdesk',
  'ccavenue',
  'easebuzz',
  'instamojo',
  'zaakpay',
  'paykun',
  'stripe',
  'paypal',
  'gateway',
  'payment',
  'merchant',

  // Government / Police / Law Enforcement / Legal
  'police',
  'cyber',
  'petition',
  'cid',
  'cbi',
  'fbi',
  'cop',
  'govt',
  'government',
  'sarkari',
  'ministry',
  'department',
  'officer',
  'inspector',
  'commissioner',
  'court',
  'judge',
  'advocate',
  'lawyer',
  'crime',
  'vigilance',
  'incometax',
  'gst',
  'rbi',
  'sebi',
  'enforcement',

  // Fraud / Scam / Suspicious
  'scam',
  'fraud',
  'fake',
  'cheat',
  'chor',
  'hacker',
  'hack',
  'testing',
  'admin',
  'support',
  'refund',
  'chargeback',
  'dispute'
];

// Normalized phonetic/typo aliases (e.g., 'cost free' -> 'cashfree')
export const KNOWN_TYPO_VARIANTS: Record<string, string> = {
  'costfree': 'cashfree',
  'cost free': 'cashfree',
  'cash free': 'cashfree',
  'cashefree': 'cashfree',
  'kashfree': 'cashfree',
  'cashfere': 'cashfree',
  'razor pay': 'razorpay',
  'rasorpay': 'razorpay',
  'rezerpay': 'razorpay',
  'pay tm': 'paytm',
  'phone pe': 'phonepe',
  'pay u': 'payu',
  'c y b e r': 'cyber',
  'p o l i c e': 'police'
};

// Allowed personal email domains
export const ALLOWED_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.co.in',
  'hotmail.com',
  'outlook.com',
  'icloud.com'
]);

/**
 * Calculates Levenshtein Distance between two strings.
 */
export function getLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Checks if a word is suspiciously close to a sensitive term (1 to 2 typo distance).
 */
export function isFuzzyMatch(word: string, term: string): boolean {
  if (word.length < 4 || term.length < 4) return false;
  // Allow max 1 distance for short words (4-6 chars), max 2 for longer words
  const maxDistance = term.length <= 6 ? 1 : 2;
  const dist = getLevenshteinDistance(word, term);
  return dist <= maxDistance;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Checks if input contains forbidden keywords, known aliases, or fuzzy typos.
 */
export function containsForbiddenOrFuzzyKeyword(input: string): { blocked: boolean; matchedTerm?: string } {
  if (!input) return { blocked: false };
  const lower = input.toLowerCase().trim();
  const cleanCompact = lower.replace(/[^a-z0-9]/g, '');
  const cleanWithSpaces = lower.replace(/[^a-z0-9]+/g, ' ').trim();
  const words = cleanWithSpaces.split(/\s+/).filter(Boolean);

  // 1. Direct check against known typo/alias dictionary
  for (const [variant, term] of Object.entries(KNOWN_TYPO_VARIANTS)) {
    const compactVariant = variant.replace(/\s+/g, '');
    if (cleanCompact.includes(compactVariant) || cleanWithSpaces.includes(variant)) {
      return { blocked: true, matchedTerm: term };
    }
  }

  // 2. Exact word & compact substring matching
  for (const term of SENSITIVE_TERMS) {
    if (words.includes(term) || cleanCompact.includes(term)) {
      return { blocked: true, matchedTerm: term };
    }
  }

  // 3. Specifically check standalone "pg" or "p g"
  if (/\bpg\b/i.test(cleanWithSpaces) || /\bp\s*g\b/i.test(lower)) {
    return { blocked: true, matchedTerm: 'PG' };
  }

  // 4. Fuzzy typo detection across words (e.g. 'costfree', 'polise', 'razorpey')
  for (const word of words) {
    for (const term of SENSITIVE_TERMS) {
      if (isFuzzyMatch(word, term)) {
        return { blocked: true, matchedTerm: term };
      }
    }
  }

  // 5. Also check 2-word combinations for composite terms like 'cost free', 'pay ment', etc.
  for (let i = 0; i < words.length - 1; i++) {
    const twoWord = words[i] + words[i + 1];
    for (const term of SENSITIVE_TERMS) {
      if (twoWord === term || isFuzzyMatch(twoWord, term)) {
        return { blocked: true, matchedTerm: term };
      }
    }
  }

  return { blocked: false };
}

/**
 * Validates customer name.
 */
export function validateCustomerName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) {
    return { valid: false, message: 'Please enter your full name.' };
  }
  if (trimmed.length > 50) {
    return { valid: false, message: 'Name must not exceed 50 characters.' };
  }

  // Check for forbidden, alias, or fuzzy typo keywords
  const check = containsForbiddenOrFuzzyKeyword(trimmed);
  if (check.blocked) {
    return {
      valid: false,
      message: 'Invalid name entered. Government, payment gateway, or modified/official terms are not allowed. Please enter your real personal name.'
    };
  }

  // Only allow alphabets, spaces, and dots
  if (!/^[a-zA-Z\s.]+$/.test(trimmed)) {
    return { valid: false, message: 'Please enter a valid personal name (letters only).' };
  }

  return { valid: true };
}

/**
 * Validates customer email.
 * Strictly blocks all government, nic, official, or custom domains.
 * Allows ONLY genuine personal mailboxes (@gmail.com, @yahoo.com, @yahoo.co.in, @hotmail.com, @outlook.com, @icloud.com).
 */
export function validateCustomerEmail(email: string): ValidationResult {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return { valid: false, message: 'Please enter your email address.' };
  }

  // Basic email pattern
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: false, message: 'Please enter a valid email address.' };
  }

  const [username, domain] = trimmed.split('@');
  if (!username || !domain) {
    return { valid: false, message: 'Please enter a valid email address.' };
  }

  // Block any gov/nic/police/official variant in the domain (e.g. gov.com, nic.com, gov.in, nic.in, etc.)
  if (
    /(?:^|\.)(?:gov|nic|mil|ac|edu|police|cyber|cbi|cid|crime)(?:\.|$)/i.test(domain) ||
    domain.includes('gov.') ||
    domain.includes('.gov') ||
    domain.includes('nic.') ||
    domain.includes('.nic') ||
    domain.includes('police') ||
    domain.includes('cyber') ||
    domain.includes('court')
  ) {
    return {
      valid: false,
      message: 'Official, institutional, or government domain emails are not permitted. Please use your personal Gmail/Yahoo/Hotmail account.'
    };
  }

  // Strict domain whitelist — only genuine personal providers allowed
  if (!ALLOWED_EMAIL_DOMAINS.has(domain)) {
    return {
      valid: false,
      message: 'Only personal email addresses (@gmail.com, @yahoo.com, @hotmail.com, @outlook.com) are accepted.'
    };
  }

  // Check username for forbidden, alias, or fuzzy typo keywords (e.g. costfree@gmail.com, cyber123@gmail.com)
  const check = containsForbiddenOrFuzzyKeyword(username);
  if (check.blocked) {
    return {
      valid: false,
      message: 'Email address contains restricted keywords. Please use your real personal email.'
    };
  }

  return { valid: true };
}
