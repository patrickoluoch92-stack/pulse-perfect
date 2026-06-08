// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.
// Also flushes errors to the server-side `app_errors` sink (Sentry-style).

import { reportAppError } from "./observability.functions";

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
  void flush(error, "global");
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}

const sentRecently = new Set<string>();

async function flush(error: unknown, source: string, context: Record<string, unknown> = {}) {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    // Throttle identical messages within 10s to avoid log floods.
    const key = `${source}:${message}`.slice(0, 200);
    if (sentRecently.has(key)) return;
    sentRecently.add(key);
    setTimeout(() => sentRecently.delete(key), 10_000);

    await reportAppError({
      data: {
        message: message.slice(0, 2000),
        stack: stack?.slice(0, 8000) ?? null,
        source,
        url: typeof window !== "undefined" ? window.location.href : null,
        context,
      },
    });
  } catch {
    // never throw from the error sink
  }
}

export function captureError(error: unknown, source = "manual", context: Record<string, unknown> = {}) {
  void flush(error, source, context);
}
