import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { FirebaseRtdb } from './firebaseRtdb';
import { AuthServiceServer } from './auth';
import { AuditLogger } from './audit';

test('PayU HTTP lifecycle: ownership, hashes, verification, test isolation, retry and live delivery',async(t)=>{
 const previous={...Object.fromEntries(['PAYU_KEY','PAYU_SALT','PAYU_ENV','RESEND_API_KEY','RESEND_FROM_EMAIL','APP_URL'].map(k=>[k,process.env[k]]))};
 Object.assign(process.env,{PAYU_KEY:'synthetic-payu',PAYU_SALT:'synthetic-salt',PAYU_ENV:'test',RESEND_API_KEY:'re_synthetic',RESEND_FROM_EMAIL:'BOOYAH STUDIO <orders@example.test>',APP_URL:'https://shop.example.test'});
 t.after(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
 const {app}=await import('./app');
 const orders=new Map<string,any>();const records=new Map<string,any>();const purchases:any[]=[];const downloads:any[]=[];const emails:any[]=[];
 t.mock.method(AuthServiceServer,'verifyOpaqueSession',async(sid:string)=>({userId:sid,email:`${sid}@example.test`}));
 t.mock.method(FirebaseRtdb,'getUserProfile',async()=>({role:'customer'}));
 t.mock.method(FirebaseRtdb,'getGlobalOrder',async(id:string)=>orders.get(id)?structuredClone(orders.get(id)):null);
 t.mock.method(FirebaseRtdb,'getUserOrderById',async(user:string,id:string)=>orders.get(id)?.userId===user?structuredClone(orders.get(id)):null);
 t.mock.method(FirebaseRtdb,'saveGlobalOrder',async(o:any)=>{orders.set(o.id,structuredClone(o));});
 t.mock.method(FirebaseRtdb,'getUserPurchases',async()=>purchases);
 t.mock.method(FirebaseRtdb,'getUserDownloads',async()=>downloads);
 t.mock.method(FirebaseRtdb,'savePurchase',async(_u:string,_id:string,p:any)=>{purchases.push(p);});
 t.mock.method(FirebaseRtdb,'saveUserDownload',async(_u:string,_id:string,d:any)=>{downloads.push(d);});
 t.mock.method(FirebaseRtdb,'set',async(path:string,value:any)=>{records.set(path,value);return value;});
 t.mock.method(FirebaseRtdb,'get',async(path:string)=>records.get(path)||null);
 t.mock.method(AuditLogger,'log',async()=>{});
 const realFetch=globalThis.fetch;let verificationOverride:any=null;let outage=false;
 t.mock.method(globalThis,'fetch',async(url:any,init:any)=>{
  if(String(url).includes('payu.in/merchant/')) {
   if(outage)throw Error('Synthetic outage');
   const form=new URLSearchParams(init.body);const txnid=form.get('var1')!;
   assert.equal(form.get('hash'),crypto.createHash('sha512').update(`synthetic-payu|verify_payment|${txnid}|synthetic-salt`).digest('hex'));
   const order=[...orders.values()].find(o=>o.payuTxnId===txnid)!;
   return Response.json({status:1,transaction_details:{[txnid]:{txnid,mihpayid:`gateway-${txnid}`,transaction_amount:String(order.total),status:'success',unmappedstatus:'captured',...verificationOverride}}});
  }
  if(String(url).includes('api.resend.com/emails')){emails.push(JSON.parse(init.body));return Response.json({id:`mail-${emails.length}`});}
  return realFetch(url,init);
 });
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());
 const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 const post=(path:string,body:any,sid='buyer')=>realFetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:`sid=${sid}`},body:JSON.stringify(body),redirect:'manual'});
 const sign=(fields:any)=>{const callback={...fields,status:'success',mihpayid:'callback-id'};callback.hash=crypto.createHash('sha512').update(['synthetic-salt','success','','','','','',...['udf5','udf4','udf3','udf2','udf1'].map(k=>callback[k]||''),callback.email,callback.firstname,callback.productinfo,callback.amount,callback.txnid,callback.key].join('|')).digest('hex');return callback;};
 for(const env of ['test','prod']) {
  process.env.PAYU_ENV=env;const id=`payu-${env}`;
  orders.set(id,{id,orderNumber:id,userId:'buyer',total:550,status:'PENDING',paymentStatus:'PENDING',currency:'INR',customer:{fullName:'Test Buyer',email:'buyer@example.test',phone:'9876543210'},items:[{productId:'linknest-pro',productTitle:'LinkNest',quantity:1,price:550}]});
  assert.equal((await post('/api/payments/payu/initiate',{orderId:id,agreeTerms:true},'other')).status,404);
  assert.equal((await post('/api/payments/payu/initiate',{orderId:id,agreeTerms:false})).status,400);
  const start=await post('/api/payments/payu/initiate',{orderId:id,agreeTerms:true});assert.equal(start.status,200);const initiated=await start.json();
  assert.equal(initiated.action,env==='test'?'https://test.payu.in/_payment':'https://secure.payu.in/_payment');
  assert.equal((await post('/api/payments/payu/initiate',{orderId:id,agreeTerms:true})).status,409);
  const callback=sign(initiated.fields);
  assert.equal((await post('/api/payments/payu/callback',{...callback,hash:'invalid'})).status,400);
  assert.equal((await post('/api/payments/payu/callback',sign({...initiated.fields,amount:'1.00'}))).status,400);
  assert.equal((await post(`/api/payments/payu/reconcile/${id}`,{},'other')).status,404);
  verificationOverride={transaction_amount:'1.00'};
  assert.equal((await (await post('/api/payments/payu/webhook',callback)).json()).success,false);assert.equal(orders.get(id).paymentStatus,'PENDING');
  verificationOverride={status:'failure',unmappedstatus:'failed'};
  const failed=await post('/api/payments/payu/webhook',callback);assert.equal(failed.status,200);assert.equal((await failed.json()).status,'FAILED');assert.equal(orders.get(id).downloadStatus,'UNAVAILABLE');
  verificationOverride=null;outage=true;assert.equal((await post('/api/payments/payu/webhook',callback)).status,503);outage=false;
  assert.equal((await post('/api/payments/payu/callback',callback)).status,303);
  const paid=orders.get(id);assert.equal(paid.paymentStatus,'PAID');
  if(env==='test') {
   assert.equal(paid.deliveryStatus,'TEST_ONLY');assert.equal(paid.downloadStatus,'UNAVAILABLE');assert.equal(paid.invoiceNumber,undefined);
   assert.equal(purchases.length,0);assert.equal(downloads.length,0);assert.equal(records.size,0);
   assert.equal((await post('/api/downloads/linknest-pro/token',{orderId:id})).status,403);
   assert.equal((await realFetch(`${base}/api/orders/${id}/invoice`,{headers:{Cookie:'sid=buyer'}})).status,403);
   assert.equal(emails.length,1);assert.equal(emails[0].attachments,undefined);assert.match(emails[0].text,/test payment/);
   process.env.PAYU_ENV='prod';assert.equal((await post('/api/payments/payu/webhook',callback)).status,400);assert.equal(orders.get(id).downloadStatus,'UNAVAILABLE');process.env.PAYU_ENV='test';
  } else {
   assert.equal(paid.deliveryStatus,'DELIVERED');assert.equal(purchases.length,1);assert.equal(downloads.length,1);assert.equal(emails[1].attachments.length,1);
   assert.equal((await post('/api/downloads/linknest-pro/token',{orderId:id})).status,200);
  }
  const count=emails.length;assert.equal((await post('/api/payments/payu/webhook',callback)).status,200);assert.equal(emails.length,count);
  orders.set(id,{...orders.get(id),status:'REVOKED',deliveryStatus:'REVOKED'});
  assert.equal((await post('/api/downloads/linknest-pro/token',{orderId:id})).status,403);
 }
});
