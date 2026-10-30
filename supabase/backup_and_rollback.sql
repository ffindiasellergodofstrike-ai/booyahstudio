-- =============================================================================
-- BOOYAHSTUDIO SAFE PRE-MIGRATION BACKUP & NON-DESTRUCTIVE ROLLBACK PACKAGE
-- =============================================================================
-- WHY THIS REPLACES `public.store_state_backup_20261030`:
-- 1. Creating an unguarded table in `public` exposes sensitive store state to
--    PostgREST (`anon` / `authenticated` roles) unless placed in a non-exposed
--    private schema with all privileges revoked.
-- 2. Running `UPDATE public.store_state SET data = backup.data` after live
--    traffic has occurred is UNSAFE because it overwrites and destroys newer
--    customer accounts, orders, payments, and refunds created since the backup.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PART 1: ACCESS-CONTROLLED PRE-MIGRATION SNAPSHOT (RUN BEFORE MIGRATION)
-- -----------------------------------------------------------------------------
begin;

create schema if not exists private_backups;
revoke all on schema private_backups from public, anon, authenticated;
grant usage on schema private_backups to service_role;

create table if not exists private_backups.migration_snapshots (
  snapshot_id text primary key,
  captured_at timestamptz not null default clock_timestamp(),
  store_state_data jsonb not null,
  store_operation_ddl text,
  cashfree_bindings_snapshot jsonb not null default '[]'::jsonb,
  cashfree_payments_snapshot jsonb not null default '[]'::jsonb,
  cashfree_refunds_snapshot jsonb not null default '[]'::jsonb
);

alter table private_backups.migration_snapshots enable row level security;
revoke all on table private_backups.migration_snapshots from public, anon, authenticated;
grant select, insert on table private_backups.migration_snapshots to service_role;

insert into private_backups.migration_snapshots (
  snapshot_id,
  store_state_data,
  store_operation_ddl,
  cashfree_bindings_snapshot,
  cashfree_payments_snapshot,
  cashfree_refunds_snapshot
)
select
  'pre_cashfree_' || to_char(clock_timestamp() at time zone 'UTC', 'YYYYMMDD_HH24MISS_MS'),
  coalesce((select data from public.store_state where id = true), '{}'::jsonb),
  case
    when to_regprocedure('public.store_operation(text,text,jsonb)') is not null
      then pg_get_functiondef('public.store_operation(text,text,jsonb)'::regprocedure)
    else null
  end,
  case
    when to_regclass('public.cashfree_order_bindings') is not null
      then coalesce((select jsonb_agg(to_jsonb(b)) from public.cashfree_order_bindings b), '[]'::jsonb)
    else '[]'::jsonb
  end,
  case
    when to_regclass('public.cashfree_payments') is not null
      then coalesce((select jsonb_agg(to_jsonb(p)) from public.cashfree_payments p), '[]'::jsonb)
    else '[]'::jsonb
  end,
  case
    when to_regclass('public.cashfree_refunds') is not null
      then coalesce((select jsonb_agg(to_jsonb(r)) from public.cashfree_refunds r), '[]'::jsonb)
    else '[]'::jsonb
  end;

commit;

-- -----------------------------------------------------------------------------
-- PART 2: NON-DESTRUCTIVE MIGRATION ROLLBACK PLAN (DO NOT RUN AUTOMATICALLY)
-- -----------------------------------------------------------------------------
-- CRITICAL SAFETY RULES:
-- 1. NEVER run `UPDATE public.store_state SET data = ...` from an older backup
--    after live traffic, as that would erase newer orders, payments, or refunds.
-- 2. NEVER drop `public.cashfree_order_bindings`, `public.cashfree_payments`, or
--    `public.cashfree_refunds` if any rows exist.
-- 3. To disable Cashfree in production without losing any order/payment/refund
--    records, unset `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` in Vercel and
--    redeploy; `public.store_operation` in `202610220001_cashfree.sql` is 100%
--    backward-compatible with Razorpay and all existing store operations.
-- 4. If you must roll back `public.store_operation` to its pre-migration DDL
--    BEFORE any live Cashfree transactions occur, execute the guarded block
--    below, which aborts if any Cashfree payments or refunds exist.
-- -----------------------------------------------------------------------------
/*
do $$
declare
  prior_ddl text;
  payment_count bigint := 0;
  refund_count bigint := 0;
begin
  if to_regclass('public.cashfree_payments') is not null then
    execute 'select count(*) from public.cashfree_payments' into payment_count;
  end if;
  if to_regclass('public.cashfree_refunds') is not null then
    execute 'select count(*) from public.cashfree_refunds' into refund_count;
  end if;

  if payment_count > 0 or refund_count > 0 then
    raise exception 'Refusing function rollback: % Cashfree payment(s) and % refund(s) exist. Disable Cashfree via environment variables instead so no payment/refund state is lost.', payment_count, refund_count;
  end if;

  select store_operation_ddl
    into prior_ddl
    from private_backups.migration_snapshots
   where store_operation_ddl is not null
   order by captured_at desc
   limit 1;

  if prior_ddl is null then
    raise exception 'No prior store_operation DDL found in private_backups.migration_snapshots';
  end if;

  execute prior_ddl;
  revoke all on function public.store_operation(text,text,jsonb) from public, anon, authenticated;
  grant execute on function public.store_operation(text,text,jsonb) to service_role;
end $$;
*/
