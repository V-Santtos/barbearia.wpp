function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms = 8000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    const id = window.setTimeout(() => {
      controller.abort();
      reject(new Error("phone-verify-timeout"));
    }, ms);

    fn(controller.signal)
      .then((value) => {
        window.clearTimeout(id);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(id);
        reject(err);
      });
  });
}

interface RetryOptions {
  attempts?: number; // padrao: 3
  timeoutMs?: number; // padrao: 8000
  delayMs?: number; // padrao: 3000
  label?: string;
}

export async function callWithRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    attempts = 3,
    timeoutMs = 8000,
    delayMs = 3000,
    label = "request",
  } = options;

  let lastError: any;

  for (let i = 1; i <= attempts; i++) {
    const startedAt = performance.now();

    try {
      console.log(`[RETRY:${label}] tentativa ${i}/${attempts}`);

      const result = await withTimeout(fn, timeoutMs);
      console.log(
        `[RETRY:${label}] sucesso tentativa ${i} em ${Math.round(
          performance.now() - startedAt,
        )}ms`,
      );
      return result;
    } catch (err) {
      lastError = err;
      console.warn(
        `[RETRY:${label}] falha tentativa ${i} em ${Math.round(
          performance.now() - startedAt,
        )}ms`,
        err,
      );

      if (i < attempts) {
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}
