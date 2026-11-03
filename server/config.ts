import { BUSINESS } from '../src/config/business';
/** Trusted redirect origin; never use a request Host header for recovery or email links. */
export function appOrigin(): string {
  const isProd = process.env.NODE_ENV === 'production';
  const deploymentHost = process.env.VERCEL_ENV === 'preview'
    ? process.env.VERCEL_URL
    : process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const platformOrigin = process.env.VERCEL && deploymentHost ? `https://${deploymentHost}` : undefined;
  
  const rawUrl = process.env.APP_URL || platformOrigin || (isProd ? BUSINESS.url : 'http://localhost:3000');
  
  try {
    const url = new URL(rawUrl);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
        (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
      console.error(`Invalid APP_URL configured: ${rawUrl}`);
      throw new Error('APP_URL must be a trusted HTTPS origin (HTTP localhost is allowed in development).');
    }
    return url.origin;
  } catch (err: any) {
    if (err.message.includes('APP_URL')) throw err;
    throw new Error(`Invalid APP_URL format: ${rawUrl}`);
  }
}
