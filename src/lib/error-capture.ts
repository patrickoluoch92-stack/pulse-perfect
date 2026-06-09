// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.
// Also flushes errors to the server-side `app_errors` sink (Sentry-style)
// from BOTH browser (window) and server (process) runtimes, with rich
// trace metadata (tenantId, userId, action, correlationId) so on-call
// engineers can filter incidents reliably.

import { reportAppError } from "./observability.functions";

export type ErrorMetadata = {
  tenantId?: string | null;
  userId?: string | null;
  action?: string | null;
  correlationId?: string | null;
  context?: Record<string, unknown>;
};

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

// --- Ambient metadata ------------------------------------------------------
// Browser: a single mutable scope updated by the app (e.g. on auth change,
// org switch, route change). Server runs share process state but each request
// may set/clear ambient via `withErrorContext` below for the duration of a
// handler. AsyncLocalStorage would be ideal but is not portable across the
// Worker runtime — `withErrorContext` is best-effort and safe.
let ambient: ErrorMetadata = {};

export function setErrorContext(meta: ErrorMetadata): void {
  ambient = { ...ambient, ...meta, context: { ...(ambient.context ?? {}), ...(meta.context ?? {}) } };
}

export function clearErrorContext(): void {
  ambient = {};
}

export function getErrorContext(): ErrorMetadata {
  return ambient;
}

/** Run `fn` with `meta` merged into the ambient context, restored after. */
export async function withErrorContext<T>(meta: ErrorMetadata, fn: () => Promise<T>): Promise<T> {
  const prev = ambient;
  ambient = {
    ...prev,
    ...meta,
    context: { ...(prev.context ?? {}), ...(meta.context ?? {}) },
  };
  try {
    return await fn();
  } finally {
    ambient = prev;
  }
}

function newCorrelationId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `cid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function record(error: unknown, source = "global", meta: ErrorMetadata = {}) {
  lastCapturedError = { error, at: Date.now() };
  void flush(error, source, meta);
}

// --- Browser ---------------------------------------------------------------
if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) =>
    record((event as ErrorEvent).error ?? event, "window.error"),
  );
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

async function flush(error: unknown, source: string, meta: ErrorMetadata = {}) {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const merged: ErrorMetadata = {
      tenantId: meta.tenantId ?? ambient.tenantId ?? null,
      userId: meta.userId ?? ambient.userId ?? null,
      action: meta.action ?? ambient.action ?? null,
      correlationId: meta.correlationId ?? ambient.correlationId ?? null,
      context: { ...(ambient.context ?? {}), ...(meta.context ?? {}) },
    };

    // Throttle identical (source, message, action) tuples within 10s to avoid
    // log floods, but never collapse rows that differ by correlation id.
    const key = `${source}:${merged.action ?? ""}:${message}:${merged.correlationId ?? ""}`.slice(0, 240);
    if (sentRecently.has(key)) return;
    sentRecently.add(key);
    setTimeout(() => sentRecently.delete(key), 10_000);

    await reportAppError({
      data: {
        message: message.slice(0, 2000),
        stack: stack?.slice(0, 8000) ?? null,
        source,
        url: typeof window !== "undefined" ? window.location.href : null,
        action: merged.action ?? null,
        correlationId: merged.correlationId ?? null,
        tenantId: merged.tenantId ?? null,
        userId: merged.userId ?? null,
        context: merged.context ?? {},
      },
    });
  } catch {
    // never throw from the error sink
  }
}

export function captureError(error: unknown, source = "manual", meta: ErrorMetadata = {}) {
  void flush(error, source, meta);
}

/**
 * Wrap an async function so any thrown error is reported to the app_errors
 * sink with the given source/action tag, then re-thrown. A correlation id is
 * generated per invocation so every error emitted during the call (including
 * downstream `captureError` calls) shares the same trace id.
 */
export function withErrorCapture<TArgs extends unknown[], TRet>(
  fn: (...args: TArgs) => Promise<TRet>,
  source: string,
  options: { action?: string } = {},
): (...args: TArgs) => Promise<TRet> {
  return async (...args: TArgs) => {
    const correlationId = newCorrelationId();
    const action = options.action ?? source;
    return withErrorContext({ action, correlationId }, async () => {
      try {
        return await fn(...args);
      } catch (err) {
        captureError(err, source, { action, correlationId });
        throw err;
      }
    });
  };
}
