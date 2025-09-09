export async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs = 40000, ...rest } = opts;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 2, baseDelay = 600 }: { retries?: number; baseDelay?: number } = {}
): Promise<T> {
  let lastErr: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === retries) break;
      const delay = baseDelay * (2 ** i);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
