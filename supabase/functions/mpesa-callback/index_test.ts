// Unit tests for pure helpers in the mpesa-callback edge function.
// Run with: supabase functions test mpesa-callback (or deno test --allow-env --allow-net).
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseMpesaCallback, validateMpesaPayload } from "./index.ts";

const success = {
  Body: {
    stkCallback: {
      MerchantRequestID: "29115-34620561-1",
      CheckoutRequestID: "ws_CO_191220191020363925",
      ResultCode: 0,
      ResultDesc: "The service request is processed successfully.",
      CallbackMetadata: {
        Item: [
          { Name: "Amount", Value: 1 },
          { Name: "MpesaReceiptNumber", Value: "NLJ7RT61SV" },
          { Name: "TransactionDate", Value: 20191219102115 },
          { Name: "PhoneNumber", Value: 254708374149 },
        ],
      },
    },
  },
};

const failed = {
  Body: {
    stkCallback: {
      MerchantRequestID: "29115-34620561-1",
      CheckoutRequestID: "ws_CO_FAIL_1",
      ResultCode: 1032,
      ResultDesc: "Request cancelled by user",
    },
  },
};

Deno.test("validateMpesaPayload accepts well-formed success", () => {
  assert(validateMpesaPayload(success));
});

Deno.test("validateMpesaPayload rejects malformed payloads", () => {
  assertFalse(validateMpesaPayload(null));
  assertFalse(validateMpesaPayload({}));
  assertFalse(validateMpesaPayload({ Body: {} }));
  assertFalse(validateMpesaPayload({ Body: { stkCallback: { CheckoutRequestID: "x" } } }));
});

Deno.test("parseMpesaCallback maps success metadata", () => {
  const parsed = parseMpesaCallback(success);
  assertEquals(parsed.status, "SUCCESS");
  assertEquals(parsed.amount, 1);
  assertEquals(parsed.mpesaReceiptNumber, "NLJ7RT61SV");
  assertEquals(parsed.phoneNumber, "254708374149");
  assertEquals(parsed.checkoutRequestId, "ws_CO_191220191020363925");
  assert(parsed.transactionDate?.startsWith("2019-12-19T10:21:15"));
});

Deno.test("parseMpesaCallback marks non-zero result codes as FAILED", () => {
  const parsed = parseMpesaCallback(failed);
  assertEquals(parsed.status, "FAILED");
  assertEquals(parsed.resultCode, 1032);
  assertEquals(parsed.amount, null);
  assertEquals(parsed.mpesaReceiptNumber, null);
});

Deno.test("parseMpesaCallback tolerates missing metadata items", () => {
  const partial = {
    Body: {
      stkCallback: {
        MerchantRequestID: "m",
        CheckoutRequestID: "ws_CO_PARTIAL",
        ResultCode: 0,
        ResultDesc: "ok",
        CallbackMetadata: { Item: [{ Name: "Amount", Value: 50 }] },
      },
    },
  };
  const parsed = parseMpesaCallback(partial);
  assertEquals(parsed.amount, 50);
  assertEquals(parsed.phoneNumber, null);
});
