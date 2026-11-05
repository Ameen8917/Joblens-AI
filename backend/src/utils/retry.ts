export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs fn, backing off exponentially with jitter between retryable failures. */
export const withRetry = async <T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> => {
  const { attempts = 3, baseDelayMs = 500, isRetryable = () => true, sleep = defaultSleep } = options;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error;
      const backoff = baseDelayMs * 2 ** (attempt - 1);
      await sleep(backoff + Math.random() * backoff);
    }
  }
};
