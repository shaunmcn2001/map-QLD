export async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs = 20000, signal, ...rest } = opts;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);

  if (signal) {
    if ((signal as AbortSignal).aborted) ctrl.abort();
    else (signal as AbortSignal).addEventListener("abort", () => ctrl.abort());
  }

  try {
    return await fetch(url, { ...rest, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 500): Promise<T> {
  let lastErr: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      if (e?.name === "AbortError" || i === retries) break;
      await new Promise(r => setTimeout(r, baseDelay * 2 ** i));
    }
  }
  throw lastErr;
}
