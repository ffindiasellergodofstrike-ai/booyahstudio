import crypto from 'node:crypto';
import type { Express, RequestHandler } from 'express';
import { Store } from './store';
import { supabaseAdmin } from './supabase';
import { isPaidOrderForProduct } from './paymentAccess';
export function registerDownloadRoutes(app: Express, auth: RequestHandler) {
  app.post('/api/downloads/:productId/token', auth, async (req: any, res) => {
    const productId = req.params.productId;
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(productId)) return res.status(400).json({ success: false });
    const orders = req.body.orderId ? [await Store.getUserOrderById(req.userId, req.body.orderId)] : await Store.getUserOrders(req.userId);
    const order = orders.find(o => isPaidOrderForProduct(o, req.userId, productId));
    if (!order) return res.status(403).json({ success: false, message: 'A verified purchase belonging to your account is required.' });
    const allowed = await Store.rpc('rate', `downloadRates/${req.userId}_${productId}`, { now: Date.now(), windowMs: 3600000, maxAttempts: 20 });
    if (!allowed) return res.status(429).json({ success: false, message: 'Download requests temporarily limited. Contact support for help.' });
    const { data, error } = await supabaseAdmin().storage.from('products').createSignedUrl(`${productId}.zip`, 60, { download: `${productId}.zip` });
    if (error || !data?.signedUrl) return res.status(503).json({ success: false, message: 'File temporarily unavailable. Contact support with your order ID.' });
    await Store.saveDownloadLog(crypto.randomUUID(), { userId: req.userId, orderId: order.id, productId, authorizedAt: new Date().toISOString(), expiresAt: Date.now() + 60000, ip: req.ip, userAgent: req.get('user-agent'), event: 'DOWNLOAD_AUTHORIZED' });
    res.json({ success: true, downloadUrl: data.signedUrl, expiresAt: Date.now() + 60000 });
  });
}
