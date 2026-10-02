import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { FirebaseRtdb } from './firebaseRtdb';
import { AuthServiceServer } from './auth';
import { AuditLogger } from './audit';

test('Easebuzz sandbox callback sends a test email and blocks every paid-file access path',async(t)=>{
 process.env.EASEBUZZ_KEY='synthetic-test-key';process.env.EASEBUZZ_SALT='synthetic-test-salt';process.env.EASEBUZZ_ENV='test';process.env.RESEND_API_KEY='re_synthetic';process.env.RESEND_FROM_EMAIL='BOOYAH STUDIO <orders@example.test>';
 const {app}=await import('./app');
 let order:any={id:'test-easebuzz-order',orderNumber:'test-easebuzz-order',userId:'buyer',paymentStatus:'PENDING',status:'PENDING',total:550,customer:{country:'India',fullName:'Test Buyer',email:'buyer@example.test',phone:'9876543210'},items:[{productId:'linknest-pro',productTitle:'LinkNest Pro',price:550,quantity:1}]};
 const records=new Map<string,any>();const emails:any[]=[];const purchases:any[]=[];let fields:any;
 t.mock.method(AuthServiceServer,'verifyOpaqueSession',async()=>({userId:'buyer',email:'buyer@example.test'}));
 t.mock.method(FirebaseRtdb,'getUserProfile',async()=>({role:'customer'}));
 t.mock.method(FirebaseRtdb,'getUserOrderById',async()=>structuredClone(order));
 t.mock.method(FirebaseRtdb,'getGlobalOrder',async()=>structuredClone(order));
 t.mock.method(FirebaseRtdb,'saveGlobalOrder',async(o:any)=>{order=structuredClone(o);});
 t.mock.method(FirebaseRtdb,'getUserPurchases',async()=>purchases);
 t.mock.method(FirebaseRtdb,'getUserDownloads',async()=>[]);
 t.mock.method(FirebaseRtdb,'savePurchase',async(_u:string,_id:string,p:any)=>{purchases.push(p);});
 t.mock.method(FirebaseRtdb,'saveUserDownload',async()=>{assert.fail('Test order must never save a download');});
 t.mock.method(FirebaseRtdb,'set',async(path:string,value:any)=>{records.set(path,value);return value;});
 t.mock.method(FirebaseRtdb,'get',async(path:string)=>records.get(path)||null);
 t.mock.method(AuditLogger,'log',async()=>{});
 const originalFetch=globalThis.fetch;
 t.mock.method(globalThis,'fetch',async(url:any,init:any)=>{
  if(String(url).includes('testpay.easebuzz.in/payment/initiateLink')){fields=Object.fromEntries(new URLSearchParams(init.body));return Response.json({status:1,data:'synthetic-access'});}
  if(String(url).includes('api.resend.com/emails')){emails.push(JSON.parse(init.body));return Response.json({id:'test-email-id'});}
  return originalFetch(url,init);
 });
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());
 const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 const post=(path:string,body:any)=>originalFetch(base+path,{method:'POST',headers:{Cookie:'sid=buyer','Content-Type':'application/json'},body:JSON.stringify(body),redirect:'manual'});
 assert.equal((await post('/api/payments/easebuzz/initiate',{orderId:order.id,agreeTerms:true})).status,200);
 assert.equal(order.paymentEnvironment,'test');assert.equal(order.paymentProvider,'Easebuzz');
 const payload={...fields,status:'success',easepayid:'synthetic-confirmed',hash:''};
 payload.hash=crypto.createHash('sha512').update(['synthetic-test-salt','success',...Array(10).fill(''),payload.email,payload.firstname,payload.productinfo,payload.amount,payload.txnid,payload.key].join('|')).digest('hex');
 assert.equal((await post('/api/payments/easebuzz/webhook',payload)).status,200);
 assert.equal(order.paymentStatus,'PAID');assert.equal(order.deliveryStatus,'TEST_ONLY');assert.equal(order.invoiceNumber,undefined);
 assert.equal(purchases.length,0);assert.equal(records.size,0);assert.equal(emails.length,1);assert.equal(emails[0].attachments,undefined);assert.doesNotMatch(emails[0].html,/href=|Download Item/);
 assert.equal((await post('/api/downloads/linknest-pro/token',{})).status,403);
 assert.equal((await originalFetch(base+`/api/orders/${order.id}/invoice`,{headers:{Cookie:'sid=buyer'}})).status,403);
 // Even stale or manually-created purchases and tokens cannot bypass the mode check.
 const purchaseId='stale-purchase';purchases.push({userId:'buyer',orderId:order.id,productId:'linknest-pro',purchaseId,accessStatus:'active'});
 const raw='T'.repeat(43);const hashed=crypto.createHash('sha256').update(raw).digest('hex');
 const token={userId:'buyer',orderId:order.id,productId:'linknest-pro',purchaseId,expiresAt:Date.now()+60000,used:false};
 records.set(`emailDownloadTokens/${hashed}`,token);records.set(`invoiceDownloadTokens/${hashed}`,token);records.set(`downloadTokens/DL-TOK-${"T".repeat(32)}`,token);
 for(const url of [`/api/downloads/email?token=${raw}`,`/api/invoices/email?token=${raw}`,`/api/downloads/stream?token=DL-TOK-${"T".repeat(32)}`]) assert.equal((await originalFetch(base+url)).status,403);
 assert.equal((await post('/api/payments/easebuzz/webhook',payload)).status,200);assert.equal(emails.length,1);
});
