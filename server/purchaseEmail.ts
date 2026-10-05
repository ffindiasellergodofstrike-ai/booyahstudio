import { PDFDocument, StandardFonts } from 'pdf-lib';
import { BUSINESS } from '../src/config/business';
/** Payment receipt only. No tax rate/classification is inferred from the GSTIN. */
export async function buildInvoicePdf(order: any): Promise<Buffer> {
 if (order.paymentEnvironment !== 'live' || order.paymentStatus !== 'PAID') throw new Error('Verified live payment required');
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
