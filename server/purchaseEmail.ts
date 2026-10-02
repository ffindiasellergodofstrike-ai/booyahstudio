import { hasLivePayment } from '../src/services/PaymentEnvironment';
import { BUSINESS } from '../src/config/business';
import crypto from 'crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Resend } from 'resend';

export interface PurchaseEmailLink {
  productId: string;
  productTitle: string;
  downloadUrl: string;
  expiresAt: number;
}

export interface PurchaseEmailResult {
  status: 'sent' | 'not_configured' | 'failed';
  emailId?: string;
  reason?: string;
}

export interface PurchaseEmailOptions {
  invoiceUrl?: string;
}

const getAppUrl = (): string => {
  try {
    const configured = new URL(process.env.APP_URL || 'https://www.booyahstudio.shop');
    if (configured.protocol === 'https:' ||
        (process.env.NODE_ENV !== 'production' && configured.protocol === 'http:')) {
      return configured.origin;
    }
  } catch {
    // Use the canonical URL if the deployment setting is invalid.
  }
  return 'https://www.booyahstudio.shop';
};

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const toPdfText = (value: unknown): string => String(value ?? '')
  .normalize('NFKD')
  .replace(/[^\x20-\x7E]/g, '?');

const money = (value: unknown): string => `INR ${Number(value || 0).toFixed(2)}`;

export const createEmailDownloadToken = (): string => crypto.randomBytes(32).toString('base64url');

export const hashEmailDownloadToken = (token: string): string => (
  crypto.createHash('sha256').update(token).digest('hex')
);

export const getPurchaseEmailLinkTtlMs = (): number => {
  const configuredHours = Number(process.env.PURCHASE_EMAIL_LINK_TTL_HOURS || 168);
  const safeHours = Number.isFinite(configuredHours)
    ? Math.min(720, Math.max(1, configuredHours))
    : 168;
  return safeHours * 60 * 60 * 1000;
};

export const buildEmailDownloadUrl = (token: string): string => (
  `${getAppUrl()}/api/downloads/email?token=${encodeURIComponent(token)}`
);

export const buildInvoiceDownloadUrl = (token: string): string => (
  `${getAppUrl()}/api/invoices/email?token=${encodeURIComponent(token)}`
);

export async function buildInvoicePdf(order: any): Promise<Buffer> {
  if (!hasLivePayment(order)) throw new Error('Live payment required for a purchase receipt.');
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 42;
  const ink = rgb(0.09, 0.11, 0.17);
  const muted = rgb(0.39, 0.42, 0.5);
  const line = rgb(0.88, 0.89, 0.93);
  const purple = rgb(0.31, 0.25, 0.74);
  const purpleLight = rgb(0.96, 0.95, 1);
  const green = rgb(0.02, 0.55, 0.34);

  const drawText = (
    value: unknown,
    x: number,
    y: number,
    size = 9,
    font: typeof regular = regular,
    color = ink,
  ) => page.drawText(toPdfText(value), { x, y, size, font, color });

  const drawRight = (
    value: unknown,
    right: number,
    y: number,
    size = 9,
    font: typeof regular = regular,
    color = ink,
  ) => {
    const text = toPdfText(value);
    drawText(text, right - font.widthOfTextAtSize(text, size), y, size, font, color);
  };

  const businessName = BUSINESS.name;
  const supportEmail = BUSINESS.email;
  const businessAddress = BUSINESS.address;
  const gstin = process.env.INVOICE_GSTIN?.trim();
  const receiptTitle = gstin ? 'TAX INVOICE' : 'PAYMENT RECEIPT';

  page.drawRectangle({ x: 0, y: height - 116, width, height: 116, color: purple });
  page.drawRectangle({ x: margin, y: height - 82, width: 34, height: 34, color: rgb(1, 1, 1), opacity: 0.16 });
  drawText('BS', margin + 9, height - 71, 12, bold, rgb(1, 1, 1));
  drawText(businessName, margin + 46, height - 62, 18, bold, rgb(1, 1, 1));
  drawText('DIGITAL PRODUCTS & SERVICES', margin + 46, height - 78, 7.5, bold, rgb(0.85, 0.83, 1));
  drawRight(receiptTitle, width - margin, height - 62, 15, bold, rgb(1, 1, 1));
  drawRight('PAID', width - margin, height - 84, 9, bold, rgb(0.77, 1, 0.88));

  let y = height - 148;

  const orderNumber = order.orderNumber || order.id || 'N/A';
  const invoiceNumber = order.invoiceNumber || `INV-${orderNumber}`;
  const orderDate = order.paymentVerifiedAt || order.updatedAt || order.createdAt || new Date().toISOString();
  const formattedDate = new Date(orderDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  page.drawRectangle({ x: margin, y: y - 84, width: 244, height: 92, color: rgb(0.98, 0.98, 0.99), borderColor: line, borderWidth: 1 });
  drawText('BILLED TO', margin + 14, y - 12, 8, bold, purple);
  drawText(order.customer?.fullName || order.customerName || 'Customer', margin + 14, y - 31, 11, bold);
  drawText(order.customer?.email || order.customerEmail || '', margin + 14, y - 48, 8.5, regular, muted);
  drawText(order.customer?.phone || order.customer?.country || 'India', margin + 14, y - 64, 8.5, regular, muted);

  const orderCardX = width - margin - 244;
  page.drawRectangle({ x: orderCardX, y: y - 84, width: 244, height: 92, color: purpleLight, borderColor: rgb(0.86, 0.84, 0.98), borderWidth: 1 });
  drawText(`INVOICE ${invoiceNumber}`, orderCardX + 14, y - 12, 8, bold, purple);
  drawText('Order ID', orderCardX + 14, y - 31, 8, regular, muted);
  drawRight(orderNumber, orderCardX + 230, y - 31, 8.5, bold);
  drawText('Date', orderCardX + 14, y - 48, 8, regular, muted);
  drawRight(formattedDate.slice(0, 22), orderCardX + 230, y - 48, 8, regular);
  drawText('Transaction', orderCardX + 14, y - 65, 8, regular, muted);
  drawRight(String(order.transactionId || order.paymentId || 'N/A').slice(0, 24), orderCardX + 230, y - 65, 8, regular);

  y -= 120;
  page.drawRectangle({ x: margin, y: y - 8, width: width - (margin * 2), height: 29, color: ink });
  drawText('ITEM DESCRIPTION', margin + 12, y + 2, 8, bold, rgb(1, 1, 1));
  drawText('QTY', 348, y + 2, 8, bold, rgb(1, 1, 1));
  drawText('UNIT PRICE', 392, y + 2, 8, bold, rgb(1, 1, 1));
  drawText('AMOUNT', 493, y + 2, 8, bold, rgb(1, 1, 1));
  y -= 31;

  for (const item of order.items || []) {
    const title = toPdfText(item.productTitle || item.title || item.productId || 'Digital Product').slice(0, 45);
    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.price || 0);
    const amount = unitPrice * quantity;
    drawText(title, margin + 12, y, 9.5, bold);
    drawText(`ID: ${String(item.productId || 'digital-product').slice(0, 36)}`, margin + 12, y - 14, 7.5, regular, muted);
    drawText(String(quantity), 353, y - 2, 9, regular);
    drawRight(money(unitPrice), 468, y - 2, 8.5, regular);
    drawRight(money(amount), width - margin - 10, y - 2, 8.5, bold);
    y -= 36;
    page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 0.7, color: line });
  }

  y -= 3;
  const totals = [
    ['Subtotal', money(order.subtotal)],
    ['Discount', Number(order.discount || 0) > 0 ? `- ${money(order.discount)}` : money(0)],
    ['Tax', money(order.tax)],
  ];
  for (const [label, value] of totals) {
    drawText(label, 375, y, 8.5, regular, muted);
    drawRight(value, width - margin - 10, y, 8.5, regular);
    y -= 17;
  }
  page.drawRectangle({ x: 363, y: y - 9, width: width - margin - 363, height: 31, color: purple });
  drawText('TOTAL PAID', 375, y + 2, 9, bold, rgb(1, 1, 1));
  drawRight(money(order.total ?? order.amount), width - margin - 10, y + 2, 10, bold, rgb(1, 1, 1));

  const termsY = Math.min(y - 72, 286);
  page.drawRectangle({ x: margin, y: termsY - 105, width: width - (margin * 2), height: 116, color: rgb(0.98, 0.98, 0.99), borderColor: line, borderWidth: 1 });
  drawText('TERMS & CONDITIONS', margin + 14, termsY - 8, 8.5, bold, purple);
  const terms = [
    '1. Digital goods are delivered electronically; no physical item will be shipped.',
    '2. Download links are confidential and must not be shared, resold, or redistributed.',
    '3. Email item links are time-limited and single-use; account download limits still apply.',
    '4. Refunds and support are governed by the Terms & Conditions and Refund Policy on the website.',
  ];
  terms.forEach((term, index) => drawText(term, margin + 14, termsY - 29 - (index * 17), 7.7, regular, muted));

  drawText(`Payment method: ${order.paymentProvider || order.paymentMethod || 'Online payment'}`, margin, 106, 8, regular, muted);
  const addressWords = `Business: ${businessAddress}`.split(' ');
  let addressLine = ''; let addressY = 91;
  for (const word of addressWords) {
    if (regular.widthOfTextAtSize(toPdfText(`${addressLine} ${word}`), 8) > width - margin * 2) { drawText(addressLine, margin, addressY, 8, regular, muted); addressY -= 11; addressLine = word; }
    else addressLine += `${addressLine ? ' ' : ''}${word}`;
  }
  drawText(addressLine, margin, addressY, 8, regular, muted);
  if (gstin) drawText(`GSTIN: ${gstin}`, margin, 68, 8, regular, muted);
  drawText(`Support: ${supportEmail}`, margin, 61, 8, regular, muted);
  page.drawLine({ start: { x: margin, y: 44 }, end: { x: width - margin, y: 44 }, thickness: 0.8, color: line });
  drawText('Computer-generated receipt - no signature required.', margin, 27, 7.5, regular, muted);
  drawRight(`Invoice ${invoiceNumber}`, width - margin, 27, 7.5, regular, muted);

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

export function buildPurchaseEmailHtml(order: any, links: PurchaseEmailLink[], options: PurchaseEmailOptions = {}): string {
  const customerName = escapeHtml(order.customer?.fullName || order.customerName || 'Customer');
  const orderNumber = escapeHtml(order.orderNumber || order.id || '');
  const invoiceNumber = escapeHtml(order.invoiceNumber || `INV-${order.orderNumber || order.id || ''}`);
  const total = escapeHtml(money(order.total ?? order.amount));
  const orderDate = escapeHtml(new Date(order.paymentVerifiedAt || order.updatedAt || order.createdAt || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  const supportEmail = escapeHtml(BUSINESS.email);
  const accountUrl = `${getAppUrl()}/account`;
  const linkRows = links.map((link) => {
    const expiry = new Date(link.expiresAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border:1px solid #e6e7ec;border-radius:12px;background:#ffffff"><tr>
      <td style="padding:17px 18px"><div style="font-size:15px;font-weight:700;color:#171923">${escapeHtml(link.productTitle)}</div><div style="font-size:12px;color:#747887;margin-top:5px">Secure ZIP package · One-time download</div></td>
      <td align="right" style="padding:17px 18px"><a href="${escapeHtml(link.downloadUrl)}" style="display:inline-block;background:#5b45d6;color:#ffffff;text-decoration:none;padding:11px 16px;border-radius:8px;font-size:13px;font-weight:700">Download Item</a></td>
    </tr><tr><td colspan="2" style="padding:0 18px 14px;font-size:11px;color:#8a8e9d">Link expires ${escapeHtml(expiry)} IST and works once.</td></tr></table>`;
  }).join('');

  const invoiceButton = options.invoiceUrl
    ? `<a href="${escapeHtml(options.invoiceUrl)}" style="display:inline-block;background:#ffffff;color:#4f3fc0;text-decoration:none;padding:12px 18px;border:1px solid #cfc9f7;border-radius:8px;font-size:13px;font-weight:700;margin:0 8px 8px 0">Download Invoice</a>`
    : '';

  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head><body style="margin:0;background:#f3f4f8;font-family:Arial,Helvetica,sans-serif;color:#171923">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent">Payment confirmed. Your order and invoice are ready.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f8"><tr><td align="center" style="padding:30px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(23,25,35,.08)">
        <tr><td style="background:#5546c9;padding:30px 34px;color:#ffffff"><table role="presentation" width="100%"><tr><td><div style="font-size:21px;font-weight:800">BOOYAH STUDIO</div><div style="font-size:11px;color:#dcd8ff;margin-top:4px;letter-spacing:1px">DIGITAL PRODUCTS & SERVICES</div></td><td align="right"><span style="display:inline-block;background:#d9fae8;color:#087647;padding:7px 11px;border-radius:99px;font-size:11px;font-weight:800">PAYMENT CONFIRMED</span></td></tr></table></td></tr>
        <tr><td style="padding:34px">
          <h1 style="font-size:25px;line-height:1.25;margin:0 0 12px;color:#171923">Your order is ready</h1>
          <p style="font-size:15px;line-height:1.65;color:#5f6372;margin:0 0 24px">Hi ${customerName}, thank you for your purchase. Your payment was successful and your digital products are ready to download.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6ff;border:1px solid #e3e0fb;border-radius:12px;margin-bottom:26px"><tr>
            <td style="padding:17px"><div style="font-size:10px;color:#77738f;letter-spacing:.7px;font-weight:700">ORDER NUMBER</div><div style="font-size:14px;font-weight:800;margin-top:5px">${orderNumber}</div></td>
            <td style="padding:17px"><div style="font-size:10px;color:#77738f;letter-spacing:.7px;font-weight:700">ORDER DATE</div><div style="font-size:13px;font-weight:700;margin-top:5px">${orderDate} IST</div></td>
            <td align="right" style="padding:17px"><div style="font-size:10px;color:#77738f;letter-spacing:.7px;font-weight:700">TOTAL PAID</div><div style="font-size:15px;font-weight:800;margin-top:5px;color:#4f3fc0">${total}</div></td>
          </tr></table>

          <h2 style="font-size:17px;margin:0 0 6px">Download your order items</h2>
          <p style="font-size:12px;line-height:1.55;color:#747887;margin:0 0 14px">For security, each email link is private, time-limited and can be used once.</p>
          ${linkRows}

          <div style="margin:24px 0;padding:20px;background:#f7f6ff;border-radius:12px">
            <div style="font-size:15px;font-weight:800;margin-bottom:6px">Invoice ${invoiceNumber} & account</div>
            <div style="font-size:12px;line-height:1.55;color:#747887;margin-bottom:15px">A PDF invoice is attached to this email. You can also download it securely below.</div>
            ${invoiceButton}<a href="${escapeHtml(accountUrl)}" style="display:inline-block;color:#4f3fc0;text-decoration:none;padding:12px 8px;font-size:13px;font-weight:700">View My Account →</a>
          </div>

          <div style="border-top:1px solid #ececf1;padding-top:22px;margin-top:26px"><div style="font-size:13px;font-weight:800;margin-bottom:10px">Important terms</div>
            <ul style="padding-left:18px;margin:0;color:#686c7b;font-size:11px;line-height:1.7"><li>Digital products are delivered electronically; no physical item will be shipped.</li><li>Links and purchased files are for the purchaser only and must not be shared, resold or redistributed.</li><li>Account download limits continue to apply after an email link is used or expires.</li><li>Refunds and support follow the Terms & Conditions and Refund Policy published on our website.</li></ul>
          </div>
        </td></tr>
        <tr><td style="background:#171923;padding:24px 34px;color:#b9bdc9;font-size:11px;line-height:1.6"><strong style="color:#ffffff">Need help?</strong> Contact <a href="mailto:${supportEmail}" style="color:#c8c1ff">${supportEmail}</a>.<br>Please keep this email private because it contains secure access links.</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

export function buildPurchaseEmailText(order: any, links: PurchaseEmailLink[], options: PurchaseEmailOptions = {}): string {
  const rows = links.map((link) => (
    `${link.productTitle}: ${link.downloadUrl}\nExpires: ${new Date(link.expiresAt).toISOString()}`
  )).join('\n\n');
  const invoice = options.invoiceUrl ? `\n\nDownload invoice: ${options.invoiceUrl}` : '';
  return `Payment successful\n\nOrder: ${order.orderNumber || order.id}\nInvoice: ${order.invoiceNumber || `INV-${order.orderNumber || order.id}`}\nAmount paid: ${money(order.total ?? order.amount)}\n\nDownload your order items:\n${rows}${invoice}\n\nA PDF invoice is attached. Keep these private links secure. Terms and refund rules are available on our website.`;
}

export async function sendPurchaseConfirmationEmail(order: any, links: PurchaseEmailLink[], options: PurchaseEmailOptions = {}): Promise<PurchaseEmailResult> {
  if (!hasLivePayment(order)) return sendTestPaymentEmail(order);
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const to = String(order.customer?.email || order.customerEmail || '').trim();

  if (!apiKey || !from) {
    return { status: 'not_configured', reason: 'Resend environment variables are not configured.' };
  }
  if (!to) {
    return { status: 'failed', reason: 'The order does not contain a customer email address.' };
  }

  const invoice = await buildInvoicePdf(order);
  const orderNumber = String(order.orderNumber || order.id || 'order');
  const safeOrderNumber = orderNumber.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
  const resend = new Resend(apiKey);
  const response = await resend.emails.send({
    from,
    to,
    replyTo: BUSINESS.email,
    subject: `Your order ${orderNumber} is ready`,
    html: buildPurchaseEmailHtml(order, links, options),
    text: buildPurchaseEmailText(order, links, options),
    attachments: [{
      filename: `invoice-${safeOrderNumber}.pdf`,
      content: invoice,
      contentType: 'application/pdf',
    }],
    tags: [{ name: 'order_id', value: safeOrderNumber || 'order' }],
  }, {
    idempotencyKey: `purchase-confirmation/${safeOrderNumber || 'order'}`,
  });

  if (response.error || !response.data?.id) {
    return { status: 'failed', reason: response.error?.message || 'Resend did not accept the email.' };
  }

  return { status: 'sent', emailId: response.data.id };
}

export function buildTestPaymentText(order: any): string {
  return `BOOYAH STUDIO — Test payment confirmation\n\nThank you for testing with us. This was a test payment, so you will not receive any product files or a purchase invoice. We will go live as soon as we are ready. Thank you for your time and support.\n\nTest order: ${order.orderNumber || order.id}\nQuestions? ${BUSINESS.email} | ${BUSINESS.phone}`;
}
export async function sendTestPaymentEmail(order: any): Promise<PurchaseEmailResult> {
  const apiKey=process.env.RESEND_API_KEY?.trim(); const from=process.env.RESEND_FROM_EMAIL?.trim();
  const to=String(order.customer?.email || order.customerEmail || '').trim();
  if(!apiKey || !from) return {status:'not_configured',reason:'Resend is not configured.'};
  if(!to) return {status:'failed',reason:'Customer email is missing.'};
  const result=await new Resend(apiKey).emails.send({from,to,replyTo:BUSINESS.email,subject:'BOOYAH STUDIO — Test payment received (no product delivery)',text:buildTestPaymentText(order),html:`<h1>BOOYAH STUDIO</h1><h2>Test payment confirmed</h2><p>${escapeHtml(buildTestPaymentText(order)).replace(/\n/g,'<br>')}</p>`}, {idempotencyKey:`test-payment/${String(order.id).replace(/[^a-zA-Z0-9_-]/g,'-')}`});
  if(result.error || !result.data?.id)return {status:'failed',reason:result.error?.message||'Email provider did not accept the message.'};
  return {status:'sent',emailId:result.data.id};
}
