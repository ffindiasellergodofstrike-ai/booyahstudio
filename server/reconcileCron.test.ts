import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { FirebaseRtdb } from './firebaseRtdb';
test('configured Vercel payment cron route is mounted and requires its bearer secret',async t=>{
 const previous=process.env.CRON_SECRET;process.env.CRON_SECRET='synthetic-cron-only';t.after(()=>{if(previous===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=previous;});
 t.mock.method(FirebaseRtdb,'getAllGlobalOrders',async()=>[]);
 const {app}=await import('./app');const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());const url=`http://127.0.0.1:${(server.address() as any).port}/api/payments/easebuzz/reconcile-cron`;
 assert.equal((await fetch(url)).status,403);const response=await fetch(url,{headers:{authorization:'Bearer synthetic-cron-only'}});assert.equal(response.status,200);assert.deepEqual(await response.json(),{success:true,reconciledCount:0,results:[]});
});
