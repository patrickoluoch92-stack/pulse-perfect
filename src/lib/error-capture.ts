// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.
// Also flushes errors to the server-side `app_errors` sink (Sentry-style)
// from BOTH browser (window) and server (process) runtimes, with rich
// trace metadata (tenantId, userId, action, correlationId, breadcrumbs)
// so on-call engineers can filter incidents reliably.

import { reportAppError } from "./observability.functions";

export type ErrorMetadata = {
  tenantId?: string | null;
  userId?: string | null;
  action?: string | null;
  correlationId?: string | null;
  context?: Record<string, unknown>;
};

export type Breadcrumb = {
  ts: number;
  category: "navigation" | "fetch" | "ui" | "auth" | "log" | "custom";
  message: string;
  level?: "info" | "warn" | "error";
  data?: Record<string, unknown>;
};

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

// --- Breadcrumbs (ring buffer) --------------------------------------------
const BREADCRUMB_MAX = 50;
const breadcrumbs: Breadcrumb[] = [];

export function addBreadcrumb(b: Omit<Breadcrumb, "ts"> & { ts?: number }): void {
  breadcrumbs.push({ ts: b.ts ?? Date.now(), ...b });
  if (breadcrumbs.length > BREADCRUMB_MAX) breadcrumbs.splice(0, breadcrumbs.length - BREADCRUMB_MAX);
}

export function getBreadcrumbs(): Breadcrumb[] {
  return breadcrumbs.slice();
}

export function clearBreadcrumbs(): void {
  breadcrumbs.length = 0;
}

// --- Ambient metadata ------------------------------------------------------
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

export function newCorrelationId(): string {
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

// --- Browser: auto-install listeners + breadcrumb instrumentation ---------
if (typeof globalThis.addEventListener === "function" && typeof window !== "undefined") {
  globalThis.addEventListener("error", (event) => {
    addBreadcrumb({
      category: "log",
      level: "error",
      message: (event as ErrorEvent).message || "window.error",
    });
    record((event as ErrorEvent).error ?? event, "window.error");
  });
  globalThis.addEventListener("unhandledrejection", (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    addBreadcrumb({
      category: "log",
      level: "error",
      message: reason instanceof Error ? reason.message : String(reason),
    });
    record(reason, "window.unhandledrejection");
  });

  // History/navigation breadcrumbs
  try {
    addBreadcrumb({ category: "navigation", message: window.location.pathname });
    const wrap = (key: "pushState" | "replaceState") => {
      const orig = history[key];
      history[key] = function (...args: Parameters<typeof orig>) {
        const r = orig.apply(this, args);
        addBreadcrumb({ category: "navigation", message: window.location.pathname });
        return r;
      } as typeof orig;
    };
    wrap("pushState");
    wrap("replaceState");
    window.addEventListener("popstate", () =>
      addBreadcrumb({ category: "navigation", message: window.location.pathname }),
    );
  } catch {
    // ignore
  }

  // Fetch breadcrumbs + correlation header injection
  try {
    const origFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const cid = ambient.correlationId ?? newCorrelationId();
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!headers.has("x-correlation-id")) headers.set("x-correlation-id", cid);
      const t0 = Date.now();
      try {
        const res = await origFetch(input as RequestInfo, { ...init, headers });
        addBreadcrumb({
          category: "fetch",
          level: res.ok ? "info" : "error",
          message: `${method} ${url} → ${res.status}`,
          data: { status: res.status, ms: Date.now() - t0, correlationId: cid },
        });
        return res;
      } catch (err) {
        addBreadcrumb({
          category: "fetch",
          level: "error",
          message: `${method} ${url} threw`,
          data: { ms: Date.now() - t0, correlationId: cid },
        });
        throw err;
      }
    };
  } catch {
    // ignore — best-effort
  }
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
        breadcrumbs: getBreadcrumbs().slice(-25),
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
 * sink. A correlation id is generated per invocation (unless one is already
 * ambient — e.g. inherited from an inbound `x-correlation-id` header) so the
 * trace can be stitched across client → server boundaries.
 */
export function withErrorCapture<TArgs extends unknown[], TRet>(
  fn: (...args: TArgs) => Promise<TRet>,
  source: string,
  options: { action?: string } = {},
): (...args: TArgs) => Promise<TRet> {
  return async (...args: TArgs) => {
    const correlationId = ambient.correlationId ?? newCorrelationId();
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
