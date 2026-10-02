import crypto from 'crypto';

export interface EasebuzzInitiateParams {
  key: string;
  salt: string;
  txnid: string;
  amount: number | string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  udf6?: string;
  udf7?: string;
  udf8?: string;
  udf9?: string;
  udf10?: string;
}

export interface EasebuzzInitiatePayload {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string;
  udf6: string;
  udf7: string;
  udf8: string;
  udf9: string;
  udf10: string;
}

export interface EasebuzzCallbackParams {
  hash?: string;
  status?: string;
  key?: string;
  txnid?: string;
  amount?: string;
  productinfo?: string;
  firstname?: string;
  email?: string;
  phone?: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  udf6?: string;
  udf7?: string;
  udf8?: string;
  udf9?: string;
  udf10?: string;
  easepayid?: string;
  error_Message?: string;
  [key: string]: any;
}

/**
 * Calculates SHA-512 hash
 */
export const sha512 = (data: string): string => {
  return crypto.createHash('sha512').update(data).digest('hex');
};

/**
 * Sanitizes and validates phone number to exact 10 digits
 */
export const sanitizePhoneNumber = (rawPhone: unknown): string => {
  if (!rawPhone || typeof rawPhone !== 'string' && typeof rawPhone !== 'number') {
    return '';
  }
  const digits = String(rawPhone).replace(/\D/g, '');
  return digits.slice(-10);
};

export const isValidIndianPhone = (phone: string): boolean => {
  return /^[6-9][0-9]{9}$/.test(phone);
};

/**
 * Validates and formats positive amount to 2 decimal places
 */
export const formatEasebuzzAmount = (rawAmount: unknown): { valid: boolean; formatted: string; value: number } => {
  const num = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount ?? '0'));
  if (isNaN(num) || !isFinite(num) || num <= 0) {
    return { valid: false, formatted: '0.00', value: 0 };
  }
  return { valid: true, formatted: num.toFixed(2), value: num };
};

/**
 * Sanitizes alphanumeric string (e.g., name, productinfo, txnid)
 */
export const sanitizeFieldText = (value: unknown, maxLength: number = 100, fallback: string = ''): string => {
  if (value === undefined || value === null) return fallback;
  const str = String(value).replace(/[\r\n|]/g, ' ').trim().replace(/\s+/g, ' ');
  return str.substring(0, maxLength) || fallback;
};

/**
 * Generates the SHA-512 hash for Easebuzz initiate payment link:
 * sequence: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|salt
 */
export const generateEasebuzzInitiateHash = (params: {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  udf6?: string;
  udf7?: string;
  udf8?: string;
  udf9?: string;
  udf10?: string;
  salt: string;
}): string => {
  const sequence = [
    params.key.trim(),
    params.txnid.trim(),
    params.amount.trim(),
    params.productinfo.trim(),
    params.firstname.trim(),
    params.email.trim(),
    (params.udf1 ?? '').trim(),
    (params.udf2 ?? '').trim(),
    (params.udf3 ?? '').trim(),
    (params.udf4 ?? '').trim(),
    (params.udf5 ?? '').trim(),
    (params.udf6 ?? '').trim(),
    (params.udf7 ?? '').trim(),
    (params.udf8 ?? '').trim(),
    (params.udf9 ?? '').trim(),
    (params.udf10 ?? '').trim(),
    params.salt.trim(),
  ];
  return sha512(sequence.join('|'));
};

/**
 * Builds the complete URLSearchParams payload for POST to /payment/initiateLink
 * Ensuring strict 1:1 matching between hash inputs and submitted body fields.
 */
export const buildEasebuzzInitiatePayload = (params: EasebuzzInitiateParams): { payload: URLSearchParams; hash: string } => {
  const key = params.key.trim();
  const salt = params.salt.trim();
  const txnid = params.txnid.trim();
  const amountObj = formatEasebuzzAmount(params.amount);
  const amount = amountObj.formatted;
  const productinfo = sanitizeFieldText(params.productinfo, 100, 'Digital Goods');
  const firstname = sanitizeFieldText(params.firstname, 50, 'Customer');
  const email = params.email.trim().toLowerCase();
  const phone = sanitizePhoneNumber(params.phone);
  const surl = params.surl.trim();
  const furl = params.furl.trim();

  const udf1 = (params.udf1 ?? '').trim();
  const udf2 = (params.udf2 ?? '').trim();
  const udf3 = (params.udf3 ?? '').trim();
  const udf4 = (params.udf4 ?? '').trim();
  const udf5 = (params.udf5 ?? '').trim();
  const udf6 = (params.udf6 ?? '').trim();
  const udf7 = (params.udf7 ?? '').trim();
  const udf8 = (params.udf8 ?? '').trim();
  const udf9 = (params.udf9 ?? '').trim();
  const udf10 = (params.udf10 ?? '').trim();

  const hash = generateEasebuzzInitiateHash({
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
    udf6,
    udf7,
    udf8,
    udf9,
    udf10,
    salt,
  });

  const payload = new URLSearchParams();
  payload.append('key', key);
  payload.append('txnid', txnid);
  payload.append('amount', amount);
  payload.append('productinfo', productinfo);
  payload.append('firstname', firstname);
  payload.append('email', email);
  payload.append('phone', phone);
  payload.append('surl', surl);
  payload.append('furl', furl);
  payload.append('hash', hash);
  if (udf1) payload.append('udf1', udf1);
  if (udf2) payload.append('udf2', udf2);
  if (udf3) payload.append('udf3', udf3);
  if (udf4) payload.append('udf4', udf4);
  if (udf5) payload.append('udf5', udf5);
  if (udf6) payload.append('udf6', udf6);
  if (udf7) payload.append('udf7', udf7);
  // Note: udf8, udf9, udf10 are included in hash calculation as empty placeholders,
  // but must NOT be sent in the POST form body per Easebuzz API specifications.
  // Empty UDFs (udf1-udf7) are also omitted from form body to avoid "Parameter validation failed" error.

  return { payload, hash };
};

/**
 * Verifies reverse hash received in Easebuzz callback/webhook:
 * sequence: salt|status|udf10|udf9|udf8|udf7|udf6|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
 */
export const verifyEasebuzzCallbackHash = (params: EasebuzzCallbackParams, salt: string): boolean => {
  if (!params || !params.hash || !salt) return false;
  const {
    hash,
    status,
    udf10,
    udf9,
    udf8,
    udf7,
    udf6,
    udf5,
    udf4,
    udf3,
    udf2,
    udf1,
    email,
    firstname,
    productinfo,
    amount,
    txnid,
    key,
  } = params;

  const hashString = [
    salt.trim(),
    status ?? '',
    udf10 ?? '',
    udf9 ?? '',
    udf8 ?? '',
    udf7 ?? '',
    udf6 ?? '',
    udf5 ?? '',
    udf4 ?? '',
    udf3 ?? '',
    udf2 ?? '',
    udf1 ?? '',
    email ?? '',
    firstname ?? '',
    productinfo ?? '',
    amount ?? '',
    txnid ?? '',
    key ?? '',
  ].join('|');

  const calculatedHash = sha512(hashString);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(String(hash).toLowerCase()),
      Buffer.from(calculatedHash.toLowerCase())
    );
  } catch {
    return false;
  }
};

/**
 * Generates hash for Easebuzz transaction retrieval API:
 * sequence: key|txnid|salt
 */
export const generateEasebuzzRetrieveHash = (params: {
  key: string;
  txnid: string;
  salt: string;
}): string => {
  const sequence = [
    params.key.trim(),
    params.txnid.trim(),
    params.salt.trim(),
  ];
  return sha512(sequence.join('|'));
};

/**
 * Returns Easebuzz base API URL based on environment
 */
export const getEasebuzzBaseUrl = (env: 'prod' | 'test'): string => {
  return env === 'prod' ? 'https://pay.easebuzz.in' : 'https://testpay.easebuzz.in';
};

export const getEasebuzzDashboardUrl = (env: 'prod' | 'test'): string => {
  return env === 'prod' ? 'https://dashboard.easebuzz.in' : 'https://testdashboard.easebuzz.in';
};
