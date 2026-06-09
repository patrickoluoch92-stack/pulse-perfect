// Correlation id helpers. Server functions wrap their handler in
// `withRequestCorrelation` to read the inbound `x-correlation-id` header
// (set by the browser fetch interceptor in `error-capture.ts`) so any error
// captured during the request shares the same trace id with browser logs.

import { newCorrelationId, withErrorContext } from "./error-capture";

export async function withRequestCorrelation<T>(
  action: string,
  fn: (correlationId: string) => Promise<T>,
): Promise<T> {
  let inbound: string | null = null;
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    inbound = getRequest()?.headers.get("x-correlation-id") ?? null;
  } catch {
    // not in a server request context
  }
  const correlationId = inbound ?? newCorrelationId();
  return withErrorContext({ action, correlationId }, () => fn(correlationId));
}
