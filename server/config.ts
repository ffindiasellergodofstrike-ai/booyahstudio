import { BUSINESS } from '../src/config/business';
/** Trusted redirect origin; never use a request Host header for recovery or email links. */
export function appOrigin(): string {
  const url = new URL(process.env.APP_URL || (process.env.NODE_ENV === 'production' ? BUSINESS.url : 'http://localhost:3000'));
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
    throw new Error('APP_URL must be a trusted HTTPS origin (HTTP localhost is allowed in development).');
  }
  return url.origin;
}
