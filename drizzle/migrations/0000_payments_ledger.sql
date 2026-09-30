-- Money is stored as bigint minor units (KES cents). Never floats.
CREATE TABLE public.pay_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  hold_hours int NOT NULL DEFAULT 24,
  min_payout_minor bigint NOT NULL DEFAULT 10000,
  default_commission_bps int NOT NULL DEFAULT 1000,
  payout_fee_mode text NOT NULL DEFAULT 'platform' CHECK (payout_fee_mode IN ('platform','provider')),
  refund_returns_commission boolean NOT NULL DEFAULT true,
  stuck_payment_minutes int NOT NULL DEFAULT 3,
  max_payout_attempts int NOT NULL DEFAULT 5
);
INSERT INTO public.pay_config DEFAULT VALUES;

CREATE TABLE public.pay_ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('asset','liability','revenue','expense')),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.pay_ledger_accounts(code,type) VALUES
 ('MPESA_COLLECTION','asset'),('CUSTOMER_REFUNDS_PAYABLE','liability'),
 ('PLATFORM_COMMISSION','revenue'),('MPESA_FEES','expense');

CREATE TABLE public.pay_ledger_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  kind text NOT NULL,
  booking_id uuid,
  reverses_id uuid REFERENCES public.pay_ledger_transactions(id),
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pay_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.pay_ledger_transactions(id),
  account_id uuid NOT NULL REFERENCES public.pay_ledger_accounts(id),
  direction char(1) NOT NULL CHECK (direction IN ('D','C')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.pay_ledger_entries(transaction_id);
CREATE INDEX ON public.pay_ledger_entries(account_id);

CREATE OR REPLACE FUNCTION public.pay_block_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ledger rows are append-only (%)', TG_TABLE_NAME; END $$;
CREATE TRIGGER pay_ltx_immutable BEFORE UPDATE OR DELETE ON public.pay_ledger_transactions FOR EACH ROW EXECUTE FUNCTION public.pay_block_mutation();
CREATE TRIGGER pay_le_immutable BEFORE UPDATE OR DELETE ON public.pay_ledger_entries FOR EACH ROW EXECUTE FUNCTION public.pay_block_mutation();

CREATE OR REPLACE FUNCTION public.pay_check_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d bigint; c bigint;
BEGIN
  SELECT coalesce(sum(amount_minor) FILTER (WHERE direction='D'),0), coalesce(sum(amount_minor) FILTER (WHERE direction='C'),0)
    INTO d, c FROM public.pay_ledger_entries WHERE transaction_id = NEW.transaction_id;
  IF d <> c OR d = 0 THEN RAISE EXCEPTION 'unbalanced ledger transaction % (D=% C=%)', NEW.transaction_id, d, c; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER pay_le_balanced AFTER INSERT ON public.pay_ledger_entries
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.pay_check_balance();

CREATE TABLE public.pay_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_kind text NOT NULL CHECK (provider_kind IN ('stay','mobility','professional')),
  provider_ref uuid NOT NULL,
  commission_bps int CHECK (commission_bps BETWEEN 0 AND 10000),
  payout_msisdn text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_kind, provider_ref)
);

CREATE TABLE public.pay_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL CHECK (source_kind IN ('stay','mobility','professional')),
  source_id uuid NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.pay_providers(id),
  customer_user_id uuid,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  commission_bps int NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','completed','cancelled','refunded','disputed')),
  paid_at timestamptz, completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_kind, source_id)
);
CREATE TABLE public.pay_booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.pay_bookings(id),
  from_status text, to_status text NOT NULL,
  actor text NOT NULL, reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.pay_booking_events(booking_id);

CREATE TABLE public.pay_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.pay_bookings(id),
  checkout_request_id text NOT NULL UNIQUE,
  merchant_request_id text,
  amount_minor bigint NOT NULL,
  msisdn_masked text,
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','confirmed','failed','flagged')),
  receipt text UNIQUE,
  callback_amount_minor bigint,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pay_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL, external_id text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz, error text, attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE TABLE public.pay_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.pay_providers(id),
  amount_minor bigint NOT NULL,
  fee_minor bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed')),
  originator_conversation_id text NOT NULL UNIQUE,
  conversation_id text, receipt text UNIQUE,
  attempts int NOT NULL DEFAULT 0, failure_reason text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pay_payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid NOT NULL REFERENCES public.pay_payouts(id),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.pay_bookings(id),
  amount_minor bigint NOT NULL
);

CREATE TABLE public.pay_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.pay_bookings(id),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  cancellation_fee_minor bigint NOT NULL DEFAULT 0,
  msisdn text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed')),
  originator_conversation_id text NOT NULL UNIQUE,
  receipt text UNIQUE, failure_reason text, attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pay_settlement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_date date NOT NULL,
  receipt text NOT NULL UNIQUE,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  amount_minor bigint NOT NULL,
  balance_minor bigint,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pay_reconciliation_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('missing_in_ledger','missing_in_statement','amount_mismatch','balance_mismatch')),
  receipt text, expected_minor bigint, actual_minor bigint, details jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_date, kind, receipt)
);

-- Grants: service_role writes; platform admins may read.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['pay_config','pay_ledger_accounts','pay_ledger_transactions','pay_ledger_entries','pay_providers','pay_bookings','pay_booking_events','pay_payments','pay_webhook_events','pay_payouts','pay_payout_items','pay_refunds','pay_settlement_lines','pay_reconciliation_breaks'] LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "admins read" ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''))', t);
  END LOOP;
END $$;

-- ===== Core functions (service_role only) =====
CREATE OR REPLACE FUNCTION public.pay_account(_code text, _type text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i uuid;
BEGIN
  SELECT id INTO i FROM pay_ledger_accounts WHERE code=_code;
  IF i IS NULL THEN
    INSERT INTO pay_ledger_accounts(code,type) VALUES (_code,_type) ON CONFLICT (code) DO NOTHING;
    SELECT id INTO i FROM pay_ledger_accounts WHERE code=_code;
  END IF;
  RETURN i;
END $$;

-- entries: [{"code":"X","type":"asset","dir":"D","amount":123}]
CREATE OR REPLACE FUNCTION public.pay_post(_key text, _kind text, _booking uuid, _memo text, _entries jsonb, _reverses uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tx uuid; e jsonb;
BEGIN
  SELECT id INTO tx FROM pay_ledger_transactions WHERE idempotency_key=_key;
  IF tx IS NOT NULL THEN RETURN tx; END IF;
  INSERT INTO pay_ledger_transactions(idempotency_key,kind,booking_id,memo,reverses_id)
    VALUES (_key,_kind,_booking,_memo,_reverses) RETURNING id INTO tx;
  FOR e IN SELECT * FROM jsonb_array_elements(_entries) LOOP
    IF (e->>'amount')::bigint = 0 THEN CONTINUE; END IF;
    INSERT INTO pay_ledger_entries(transaction_id,account_id,direction,amount_minor)
      VALUES (tx, pay_account(e->>'code', e->>'type'), e->>'dir', (e->>'amount')::bigint);
  END LOOP;
  RETURN tx;
END $$;

-- Reversal: mirror every entry of the original transaction.
CREATE OR REPLACE FUNCTION public.pay_reverse(_tx uuid, _key text, _memo text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r uuid; b uuid;
BEGIN
  SELECT id INTO r FROM pay_ledger_transactions WHERE idempotency_key=_key;
  IF r IS NOT NULL THEN RETURN r; END IF;
  SELECT booking_id INTO b FROM pay_ledger_transactions WHERE id=_tx;
  INSERT INTO pay_ledger_transactions(idempotency_key,kind,booking_id,memo,reverses_id)
    VALUES (_key,'reversal',b,_memo,_tx) RETURNING id INTO r;
  INSERT INTO pay_ledger_entries(transaction_id,account_id,direction,amount_minor)
    SELECT r, account_id, CASE direction WHEN 'D' THEN 'C' ELSE 'D' END, amount_minor
    FROM pay_ledger_entries WHERE transaction_id=_tx;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.pay_account_balance(_code text) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(sum(CASE WHEN (a.type IN ('asset','expense')) = (e.direction='D') THEN e.amount_minor ELSE -e.amount_minor END),0)::bigint
  FROM pay_ledger_entries e JOIN pay_ledger_accounts a ON a.id=e.account_id WHERE a.code=_code
$$;

-- Central state machine. Only place bookings.status changes.
CREATE OR REPLACE FUNCTION public.pay_transition(_booking uuid, _to text, _actor text, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cur text;
BEGIN
  SELECT status INTO cur FROM pay_bookings WHERE id=_booking FOR UPDATE;
  IF cur IS NULL THEN RAISE EXCEPTION 'booking % not found', _booking; END IF;
  IF cur = _to THEN RETURN cur; END IF;
  IF NOT ((cur='pending' AND _to IN ('paid','cancelled'))
       OR (cur='paid' AND _to IN ('completed','cancelled','disputed'))
       OR (cur='completed' AND _to IN ('disputed','refunded'))
       OR (cur='disputed' AND _to IN ('paid','completed','refunded','cancelled'))) THEN
    RAISE EXCEPTION 'illegal transition % -> %', cur, _to USING ERRCODE='P0001';
  END IF;
  UPDATE pay_bookings SET status=_to, updated_at=now(),
    paid_at = CASE WHEN _to='paid' AND paid_at IS NULL THEN now() ELSE paid_at END,
    completed_at = CASE WHEN _to='completed' THEN now() ELSE completed_at END
   WHERE id=_booking;
  INSERT INTO pay_booking_events(booking_id,from_status,to_status,actor,reason) VALUES (_booking,cur,_to,_actor,_reason);
  RETURN _to;
END $$;

-- STK callback processing, all in one DB transaction.
CREATE OR REPLACE FUNCTION public.pay_process_stk(_checkout text, _result_code int, _receipt text, _amount_minor bigint, _desc text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p pay_payments; bk pay_bookings;
BEGIN
  SELECT * INTO p FROM pay_payments WHERE checkout_request_id=_checkout FOR UPDATE;
  IF p.id IS NULL THEN RETURN 'unknown_checkout'; END IF;
  IF p.status <> 'initiated' THEN RETURN 'already_'||p.status; END IF;
  IF _result_code <> 0 THEN
    UPDATE pay_payments SET status='failed', failure_reason=_desc, updated_at=now() WHERE id=p.id;
    RETURN 'failed';
  END IF;
  IF _amount_minor IS DISTINCT FROM p.amount_minor THEN
    UPDATE pay_payments SET status='flagged', receipt=_receipt, callback_amount_minor=_amount_minor,
      failure_reason='amount_mismatch', updated_at=now() WHERE id=p.id;
    RETURN 'flagged';
  END IF;
  SELECT * INTO bk FROM pay_bookings WHERE id=p.booking_id FOR UPDATE;
  UPDATE pay_payments SET status='confirmed', receipt=_receipt, callback_amount_minor=_amount_minor, updated_at=now() WHERE id=p.id;
  PERFORM pay_post('payment:'||_receipt, 'payment', bk.id, 'M-Pesa collection',
    jsonb_build_array(
      jsonb_build_object('code','MPESA_COLLECTION','type','asset','dir','D','amount',p.amount_minor),
      jsonb_build_object('code','PROVIDER_PENDING:'||bk.provider_id,'type','liability','dir','C','amount',p.amount_minor)));
  PERFORM pay_transition(bk.id,'paid','mpesa_callback','receipt '||_receipt);
  RETURN 'confirmed';
END $$;

CREATE OR REPLACE FUNCTION public.pay_complete_booking(_booking uuid, _actor text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE bk pay_bookings; comm bigint;
BEGIN
  SELECT * INTO bk FROM pay_bookings WHERE id=_booking FOR UPDATE;
  PERFORM pay_transition(_booking,'completed',_actor,'service completed');
  comm := (bk.amount_minor * bk.commission_bps) / 10000;
  PERFORM pay_post('complete:'||_booking,'completion',_booking,'Commission earned',
    jsonb_build_array(
      jsonb_build_object('code','PROVIDER_PENDING:'||bk.provider_id,'type','liability','dir','D','amount',bk.amount_minor),
      jsonb_build_object('code','PLATFORM_COMMISSION','type','revenue','dir','C','amount',comm),
      jsonb_build_object('code','PROVIDER_PAYABLE:'||bk.provider_id,'type','liability','dir','C','amount',bk.amount_minor-comm)));
END $$;

-- Cancel / refund. _refund_minor = amount returned to customer; remainder of gross is a cancellation fee.
CREATE OR REPLACE FUNCTION public.pay_cancel_or_refund(_booking uuid, _refund_minor bigint, _msisdn text, _actor text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE bk pay_bookings; cfg pay_config; comm bigint; payable bigint; p_rev bigint; c_rev bigint; fee bigint;
  pi record; rid uuid; ocid text; target text;
BEGIN
  SELECT * INTO cfg FROM pay_config;
  SELECT * INTO bk FROM pay_bookings WHERE id=_booking FOR UPDATE;
  IF _refund_minor < 0 OR _refund_minor > bk.amount_minor THEN RAISE EXCEPTION 'invalid refund amount'; END IF;
  fee := bk.amount_minor - _refund_minor;
  ocid := 'refund-'||replace(gen_random_uuid()::text,'-','');

  IF bk.status IN ('paid') OR (bk.status='disputed' AND bk.completed_at IS NULL) THEN
    target := 'cancelled';
    PERFORM pay_post('cancel:'||_booking,'cancellation',_booking,_reason,
      jsonb_build_array(
        jsonb_build_object('code','PROVIDER_PENDING:'||bk.provider_id,'type','liability','dir','D','amount',bk.amount_minor),
        jsonb_build_object('code','CUSTOMER_REFUNDS_PAYABLE','type','liability','dir','C','amount',_refund_minor),
        jsonb_build_object('code','PLATFORM_COMMISSION','type','revenue','dir','C','amount',fee)));
  ELSIF bk.status IN ('completed','disputed') THEN
    target := 'refunded';
    SELECT i.id, p.status INTO pi FROM pay_payout_items i JOIN pay_payouts p ON p.id=i.payout_id WHERE i.booking_id=_booking FOR UPDATE OF p;
    IF pi.id IS NOT NULL THEN
      IF pi.status IN ('processing','paid') THEN RAISE EXCEPTION 'payout already % for this booking; resolve manually', pi.status; END IF;
      -- freeze: pull the booking out of the unpaid payout
      UPDATE pay_payouts SET amount_minor = amount_minor - (SELECT amount_minor FROM pay_payout_items WHERE id=pi.id), updated_at=now()
        WHERE id=(SELECT payout_id FROM pay_payout_items WHERE id=pi.id);
      DELETE FROM pay_payout_items WHERE id=pi.id;
    END IF;
    comm := (bk.amount_minor * bk.commission_bps)/10000;
    payable := bk.amount_minor - comm;
    IF cfg.refund_returns_commission THEN
      p_rev := (payable * _refund_minor) / bk.amount_minor; c_rev := _refund_minor - p_rev;
    ELSE
      p_rev := LEAST(_refund_minor, payable); c_rev := 0;
      IF _refund_minor > payable THEN RAISE EXCEPTION 'refund exceeds provider share while commission is retained'; END IF;
    END IF;
    PERFORM pay_post('refund-post:'||_booking,'refund',_booking,_reason,
      jsonb_build_array(
        jsonb_build_object('code','PROVIDER_PAYABLE:'||bk.provider_id,'type','liability','dir','D','amount',p_rev),
        jsonb_build_object('code','PLATFORM_COMMISSION','type','revenue','dir','D','amount',c_rev),
        jsonb_build_object('code','CUSTOMER_REFUNDS_PAYABLE','type','liability','dir','C','amount',_refund_minor)));
  ELSIF bk.status='pending' THEN
    PERFORM pay_transition(_booking,'cancelled',_actor,_reason); RETURN NULL;
  ELSE
    RAISE EXCEPTION 'cannot refund booking in status %', bk.status;
  END IF;
  PERFORM pay_transition(_booking,target,_actor,_reason);
  IF _refund_minor > 0 THEN
    INSERT INTO pay_refunds(booking_id,amount_minor,cancellation_fee_minor,msisdn,originator_conversation_id)
      VALUES (_booking,_refund_minor,fee,_msisdn,ocid) RETURNING id INTO rid;
  END IF;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.pay_refund_result(_ocid text, _success boolean, _receipt text, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r pay_refunds;
BEGIN
  SELECT * INTO r FROM pay_refunds WHERE originator_conversation_id=_ocid FOR UPDATE;
  IF r.id IS NULL THEN RETURN 'unknown'; END IF;
  IF r.status='sent' THEN RETURN 'already_sent'; END IF;
  IF _success THEN
    UPDATE pay_refunds SET status='sent', receipt=_receipt, updated_at=now() WHERE id=r.id;
    PERFORM pay_post('refund:'||r.id,'refund_sent',r.booking_id,'Refund sent',
      jsonb_build_array(
        jsonb_build_object('code','CUSTOMER_REFUNDS_PAYABLE','type','liability','dir','D','amount',r.amount_minor),
        jsonb_build_object('code','MPESA_COLLECTION','type','asset','dir','C','amount',r.amount_minor)));
    RETURN 'sent';
  END IF;
  UPDATE pay_refunds SET status='failed', failure_reason=_reason, attempts=attempts+1, updated_at=now() WHERE id=r.id;
  RETURN 'failed';
END $$;

-- Build payouts. Advisory lock + UNIQUE(booking_id) make concurrent runs safe.
CREATE OR REPLACE FUNCTION public.pay_build_payouts() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg pay_config; g record; pid uuid; n int := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('pay_build_payouts')) THEN RETURN 0; END IF;
  SELECT * INTO cfg FROM pay_config;
  FOR g IN
    SELECT b.provider_id, array_agg(b.id) ids,
           sum(b.amount_minor - (b.amount_minor*b.commission_bps)/10000) total
    FROM pay_bookings b
    WHERE b.status='completed' AND b.completed_at + make_interval(hours=>cfg.hold_hours) <= now()
      AND NOT EXISTS (SELECT 1 FROM pay_payout_items i WHERE i.booking_id=b.id)
    GROUP BY b.provider_id
    HAVING sum(b.amount_minor - (b.amount_minor*b.commission_bps)/10000) >= cfg.min_payout_minor
  LOOP
    INSERT INTO pay_payouts(provider_id,amount_minor,originator_conversation_id)
      VALUES (g.provider_id,g.total,'payout-'||replace(gen_random_uuid()::text,'-','')) RETURNING id INTO pid;
    INSERT INTO pay_payout_items(payout_id,booking_id,amount_minor)
      SELECT pid, b.id, b.amount_minor-(b.amount_minor*b.commission_bps)/10000 FROM pay_bookings b WHERE b.id = ANY(g.ids);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Claim payouts ready to send (pending/failed & due), mark processing.
CREATE OR REPLACE FUNCTION public.pay_claim_payouts(_limit int DEFAULT 20)
RETURNS SETOF pay_payouts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg pay_config;
BEGIN
  SELECT * INTO cfg FROM pay_config;
  RETURN QUERY
  UPDATE pay_payouts p SET status='processing', attempts=attempts+1, updated_at=now()
  WHERE p.id IN (SELECT id FROM pay_payouts WHERE status IN ('pending','failed') AND next_attempt_at<=now()
                 AND attempts < cfg.max_payout_attempts AND amount_minor > 0
                 ORDER BY created_at LIMIT _limit FOR UPDATE SKIP LOCKED)
  RETURNING p.*;
END $$;

CREATE OR REPLACE FUNCTION public.pay_payout_result(_ocid text, _success boolean, _receipt text, _fee_minor bigint, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p pay_payouts; cfg pay_config; prov_fee bigint := 0;
BEGIN
  SELECT * INTO cfg FROM pay_config;
  SELECT * INTO p FROM pay_payouts WHERE originator_conversation_id=_ocid FOR UPDATE;
  IF p.id IS NULL THEN RETURN 'unknown'; END IF;
  IF p.status='paid' THEN RETURN 'already_paid'; END IF;
  IF _success THEN
    UPDATE pay_payouts SET status='paid', receipt=_receipt, fee_minor=coalesce(_fee_minor,0), failure_reason=NULL, updated_at=now() WHERE id=p.id;
    PERFORM pay_post('payout:'||p.id,'payout',NULL,'B2C payout',
      jsonb_build_array(
        jsonb_build_object('code','PROVIDER_PAYABLE:'||p.provider_id,'type','liability','dir','D','amount',p.amount_minor),
        jsonb_build_object('code','MPESA_COLLECTION','type','asset','dir','C','amount',p.amount_minor)));
    IF coalesce(_fee_minor,0) > 0 THEN
      PERFORM pay_post('payout-fee:'||p.id,'fee',NULL,'B2C fee',
        jsonb_build_array(
          jsonb_build_object('code','MPESA_FEES','type','expense','dir','D','amount',_fee_minor),
          jsonb_build_object('code','MPESA_COLLECTION','type','asset','dir','C','amount',_fee_minor)));
    END IF;
    RETURN 'paid';
  END IF;
  UPDATE pay_payouts SET status='failed', failure_reason=_reason,
    next_attempt_at = now() + make_interval(mins => (5 * power(2, LEAST(attempts,6)))::int), updated_at=now()
   WHERE id=p.id;
  RETURN 'failed';
END $$;

-- Daily reconciliation against imported settlement lines.
CREATE OR REPLACE FUNCTION public.pay_reconcile(_date date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int; ledger bigint; stmt bigint;
BEGIN
  INSERT INTO pay_reconciliation_breaks(run_date,kind,receipt,actual_minor)
    SELECT _date,'missing_in_ledger',s.receipt,s.amount_minor FROM pay_settlement_lines s
    WHERE s.statement_date=_date
      AND NOT EXISTS (SELECT 1 FROM pay_payments p WHERE p.receipt=s.receipt AND p.status='confirmed')
      AND NOT EXISTS (SELECT 1 FROM pay_payouts o WHERE o.receipt=s.receipt AND o.status='paid')
      AND NOT EXISTS (SELECT 1 FROM pay_refunds r WHERE r.receipt=s.receipt AND r.status='sent')
    ON CONFLICT DO NOTHING;
  INSERT INTO pay_reconciliation_breaks(run_date,kind,receipt,expected_minor,actual_minor)
    SELECT _date,'amount_mismatch',s.receipt,x.amt,s.amount_minor FROM pay_settlement_lines s
    JOIN (SELECT receipt, amount_minor amt FROM pay_payments WHERE status='confirmed'
          UNION ALL SELECT receipt, amount_minor FROM pay_payouts WHERE status='paid'
          UNION ALL SELECT receipt, amount_minor FROM pay_refunds WHERE status='sent') x ON x.receipt=s.receipt
    WHERE s.statement_date=_date AND x.amt <> s.amount_minor
    ON CONFLICT DO NOTHING;
  INSERT INTO pay_reconciliation_breaks(run_date,kind,receipt,expected_minor)
    SELECT _date,'missing_in_statement',x.receipt,x.amt FROM
     (SELECT receipt, amount_minor amt, updated_at::date d FROM pay_payments WHERE status='confirmed'
      UNION ALL SELECT receipt, amount_minor, updated_at::date FROM pay_payouts WHERE status='paid'
      UNION ALL SELECT receipt, amount_minor, updated_at::date FROM pay_refunds WHERE status='sent') x
    WHERE x.d=_date AND x.receipt IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pay_settlement_lines s WHERE s.receipt=x.receipt)
    ON CONFLICT DO NOTHING;
  ledger := pay_account_balance('MPESA_COLLECTION');
  SELECT balance_minor INTO stmt FROM pay_settlement_lines WHERE statement_date=_date AND balance_minor IS NOT NULL ORDER BY created_at DESC LIMIT 1;
  IF stmt IS NOT NULL AND stmt <> ledger THEN
    INSERT INTO pay_reconciliation_breaks(run_date,kind,receipt,expected_minor,actual_minor)
      VALUES (_date,'balance_mismatch','MPESA_COLLECTION',ledger,stmt) ON CONFLICT DO NOTHING;
  END IF;
  SELECT count(*) INTO n FROM pay_reconciliation_breaks WHERE run_date=_date AND resolved_at IS NULL;
  RETURN jsonb_build_object('breaks',n,'ledger_balance',ledger,'statement_balance',stmt);
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['pay_account(text,text)','pay_post(text,text,uuid,text,jsonb,uuid)','pay_reverse(uuid,text,text)','pay_account_balance(text)','pay_transition(uuid,text,text,text)','pay_process_stk(text,int,text,bigint,text)','pay_complete_booking(uuid,text)','pay_cancel_or_refund(uuid,bigint,text,text,text)','pay_refund_result(text,boolean,text,text)','pay_build_payouts()','pay_claim_payouts(int)','pay_payout_result(text,boolean,text,bigint,text)','pay_reconcile(date)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;