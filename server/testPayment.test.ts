import test from 'node:test';
import assert from 'node:assert/strict';
import { isPaidOrderForProduct } from './paymentAccess';
import { buildInvoicePdf, sendPurchaseConfirmationEmail } from './purchaseEmail';
import { isVerifiedPaidOrder } from '../src/services/PaymentVerification';

test('Test and legacy orders cannot authorize downloads, browser delivery or purchase invoices',async()=>{
 for(const paymentEnvironment of ['test',undefined]) {
  const order:any={id:'test-order',userId:'buyer',paymentEnvironment,paymentStatus:'PAID',paymentProvider:'PayU',transactionId:'verified',status:'PAID',deliveryStatus:'DELIVERED',downloadStatus:'AVAILABLE',items:[{productId:'product'}]};
  assert.equal(isPaidOrderForProduct(order,'buyer','product'),false);
  assert.equal(isVerifiedPaidOrder(order),false);
  await assert.rejects(buildInvoicePdf(order),/Live payment required/);
 }
});
test('Even a direct purchase-email call for a test order sends only a test notice',async(t)=>{
 const before={key:process.env.RESEND_API_KEY,from:process.env.RESEND_FROM_EMAIL};
 process.env.RESEND_API_KEY='re_synthetic';process.env.RESEND_FROM_EMAIL='BOOYAH STUDIO <orders@example.test>';
 t.after(()=>{for(const [key,value] of Object.entries({RESEND_API_KEY:before.key,RESEND_FROM_EMAIL:before.from})){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
 let payload:any;
 t.mock.method(globalThis,'fetch',async(_url:any,init:any)=>{payload=JSON.parse(init.body);return Response.json({id:'synthetic-mail'});});
 const result=await sendPurchaseConfirmationEmail({id:'test-order',paymentEnvironment:'test',customerEmail:'buyer@example.test'},[{productId:'paid',productTitle:'Paid File',downloadUrl:'https://example.test/secret.zip',expiresAt:Date.now()}],{invoiceUrl:'https://example.test/invoice'});
 assert.equal(result.status,'sent');assert.match(payload.subject,/Test payment/);assert.equal(payload.attachments,undefined);
 assert.doesNotMatch(payload.html,/secret\.zip|href=|Download Item|Download Invoice/);
 assert.match(payload.text,/will not receive any product files/);assert.equal(payload.reply_to,'connectbooyahstudio@gmail.com');
});
