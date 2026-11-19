// Keep the same UTC daily reconciliation fallback previously configured.
// Secret-bearing requests must never be initiated by browsers.
export default async function reconcile() {
  const appUrl = process.env.APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!appUrl || !secret) {
    console.warn('Skipping reconciliation: APP_URL or CRON_SECRET is not configured.');
    return;
  }
  const response = await fetch(new URL('/api/jobs/reconcile', appUrl), {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) throw new Error(`Reconciliation returned HTTP ${response.status}`);
}

export const config = { schedule: '0 0 * * *' };
