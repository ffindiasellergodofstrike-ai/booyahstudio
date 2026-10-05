import { PDFDocument, StandardFonts } from 'pdf-lib';
import { BUSINESS } from '../src/config/business';
/** Payment receipt only. No tax rate/classification is inferred from the GSTIN. */
export async function buildInvoicePdf(order: any): Promise<Buffer> {
 if (order.paymentEnvironment !== 'live' || order.paymentStatus !== 'PAID') throw new Error('Verified Live payment required');
 const pdf=await PDFDocument.create(), font=await pdf.embedFont(StandardFonts.Helvetica);
 let page=pdf.addPage(), y=790;
 const line=(value:string) => {
  const words=String(value).normalize('NFKD').replace(/[^\x20-\x7E]/g,' ').split(/\s+/);
  let text='';
  const draw=()=>{ if(y<45){page=pdf.addPage();y=790;}page.drawText(text,{x:40,y,size:10,font});y-=17;text=''; };
  for(const word of words){if(font.widthOfTextAtSize(`${text} ${word}`,10)>510 && text)draw();text+=(text?' ':'')+word;}draw();
 };
 line(`${BUSINESS.owner} | ${BUSINESS.legalName} | ${BUSINESS.name}`);
 line(`GSTIN: ${BUSINESS.gstin}`);line(BUSINESS.address);line(`${BUSINESS.email} | WhatsApp ${BUSINESS.phone}`);
 y-=15;line('PAYMENT RECEIPT (not a GST tax invoice)');line(`Order: ${order.id}`);line(`Payment: ${order.transactionId}`);line(`Verified: ${order.paymentVerifiedAt || order.createdAt}`);line(`Customer: ${order.customerEmail}`);y-=10;
 for(const item of order.items || [])line(`${item.productTitle} | Qty ${item.quantity} | INR ${Number(item.price).toFixed(2)}`);
 y-=10;line(`Discount: INR ${Number(order.discount || 0).toFixed(2)}`);line(`Amount paid: INR ${Number(order.total).toFixed(2)}`);
 line('For applicable tax documentation, contact the merchant. Download purchased files from your account.');
 return Buffer.from(await pdf.save());
}

export async function sendPurchaseConfirmationEmail(order: any, items: any[] = [], options: any = {}) {
  const isLive = order?.paymentEnvironment === 'live';
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || `${BUSINESS.name} <orders@booyahstudio.com>`;

  const subject = isLive
    ? `${BUSINESS.name}: Purchase Confirmation (Order ${order?.id})`
    : `${BUSINESS.name}: Test payment (Order ${order?.id})`;

  let text = '';
  let html: string | undefined = isLive ? '' : '';

  if (!isLive) {
    text = `Test payment recorded for order ${order?.id}. You will not receive any product files.`;
  } else {
    text = `Thank you for your purchase! Order ${order?.id}\n\n`;
    html = `<div><p>Thank you for your purchase!</p>`;
    if (items.length > 0) {
      text += `Your Products:\n`;
      for (const item of items) {
        text += `- ${item.productTitle}: ${item.downloadUrl}\n`;
        html += `<p><a href="${item.downloadUrl}">Download Item: ${item.productTitle}</a></p>`;
      }
    }
    if (options.invoiceUrl) {
      text += `Invoice: ${options.invoiceUrl}\n`;
      html += `<p><a href="${options.invoiceUrl}">Download Invoice</a></p>`;
    }
    html += `</div>`;
  }

  const payload: any = {
    from: fromEmail,
    to: order?.customerEmail,
    subject,
    text,
    html,
    reply_to: 'connectbooyahstudio@gmail.com',
  };

  if (isLive && options.invoicePdfBuffer) {
    payload.attachments = [{ filename: `Invoice-${order?.id}.pdf`, content: options.invoicePdfBuffer.toString('base64') }];
  }

  if (apiKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  }

  return { status: 'sent' };
}
