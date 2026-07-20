import { useEffect, useState } from "react";

/**
 * Returns a debounced version of the provided value.
 * Useful for wiring text inputs directly into queries without spamming the server.
 */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
