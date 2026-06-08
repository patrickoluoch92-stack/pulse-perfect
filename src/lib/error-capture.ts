// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.
// Also flushes errors to the server-side `app_errors` sink (Sentry-style)
// from BOTH browser (window) and server (process) runtimes.

import { reportAppError } from "./observability.functions";

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown, source = "global") {
  lastCapturedError = { error, at: Date.now() };
  void flush(error, source);
}

// --- Browser ---------------------------------------------------------------
if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event, "window.error"));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason, "window.unhandledrejection"),
  );
}

// --- Server (Node / Worker) ------------------------------------------------
const proc = (globalThis as { process?: NodeJS.Process }).process;
if (proc && typeof proc.on === "function") {
  const installed = (proc as unknown as { __lovableErrCapture?: boolean }).__lovableErrCapture;
  if (!installed) {
    (proc as unknown as { __lovableErrCapture?: boolean }).__lovableErrCapture = true;
    try {
      proc.on("uncaughtException", (err) => record(err, "process.uncaughtException"));
      proc.on("unhandledRejection", (reason) => record(reason, "process.unhandledRejection"));
    } catch {
      // some runtimes (workers) restrict process listeners
    }
  }
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

/**
 * Wrap an async function so any thrown error is reported to the app_errors
 * sink with the given source tag, then re-thrown. Use for server-fn handlers,
 * route loaders, and other top-level boundaries.
 */
export function withErrorCapture<TArgs extends unknown[], TRet>(
  fn: (...args: TArgs) => Promise<TRet>,
  source: string,
): (...args: TArgs) => Promise<TRet> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (err) {
      captureError(err, source);
      throw err;
    }
  };
}
