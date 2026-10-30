-- Non-destructive verification script: runs inside BEGIN ... ROLLBACK so no existing customer, order, or payment data is persisted or modified.
begin;
set local role service_role;
do $$
declare
 order_doc jsonb;
begin
 perform public.store_operation('set', 'orders/verify_tx_order', '{"id":"verify_tx_order","userId":"verify_tx_user","total":100,"paymentStatus":"PENDING","status":"PENDING","deliveryStatus":"PENDING","downloadStatus":"UNAVAILABLE","items":[{"productId":"verify_item","productTitle":"Verify Item","price":100,"quantity":1}]}'::jsonb);
 order_doc := public.store_operation('bind_cashfree', 'orders/verify_tx_order', '{"cashfreeOrderId":"verify_tx_order","cfOrderId":"cf_verify_tx","paymentProvider":"Cashfree","paymentEnvironment":"test","policyVersion":"verify","policyAcceptedAt":"2026-10-30T00:00:00Z"}'::jsonb);
 if order_doc->>'cashfreeOrderId' <> 'verify_tx_order' then
  raise exception 'Cashfree order binding verification failed';
 end if;
 order_doc := public.store_operation('sync_cashfree_snapshot', 'orders/verify_tx_order', '{"payments":[{"id":"pay_verify_tx","order_id":"verify_tx_order","amount":10000,"currency":"INR","status":"SUCCESS","environment":"test"}],"refunds":[]}'::jsonb);
 if order_doc->>'paymentStatus' <> 'PAID' or order_doc->>'deliveryStatus' <> 'TEST_ONLY' then
  raise exception 'Cashfree sandbox snapshot isolation verification failed';
 end if;
end $$;
reset role;
do $$
declare
 tbl text;
begin
 foreach tbl in array array['store_state','cashfree_order_bindings','cashfree_payments','cashfree_refunds'] loop
  if has_table_privilege('anon', 'public.' || tbl, 'SELECT') or has_table_privilege('authenticated', 'public.' || tbl, 'SELECT') then
   raise exception 'Public/authenticated table exposure on %', tbl;
  end if;
  if not (select relrowsecurity from pg_class where oid = ('public.' || tbl)::regclass) then
   raise exception 'RLS not enabled on %', tbl;
  end if;
 end loop;
 if has_function_privilege('anon', 'public.store_operation(text,text,jsonb)', 'EXECUTE') or
    has_function_privilege('authenticated', 'public.store_operation(text,text,jsonb)', 'EXECUTE') then
  raise exception 'Public/authenticated function exposure on store_operation';
 end if;
 if has_function_privilege('anon', 'public.store_set(jsonb,text[],jsonb)', 'EXECUTE') or
    has_function_privilege('authenticated', 'public.store_set(jsonb,text[],jsonb)', 'EXECUTE') then
  raise exception 'Public/authenticated function exposure on store_set';
 end if;
end $$;
rollback;
