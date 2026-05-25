/**
 * Универсальный executeWithRetry для асинхронных операций ApiShip.
 *
 * MIT-атрибуция: алгоритм портирован из gorgojs/medusa-plugins
 *   (packages/medusa-fulfillment-apiship/src/providers/fulfillment-apiship/core/apiship-base.ts:executeWithRetry).
 */

export interface RetryConfig<T> {
  apiCall: () => Promise<T>;
  isReady: (res: T) => boolean;
  maxAttempts?: number;
  baseDelay?: number;
  label?: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function executeWithRetry<T>({
  apiCall,
  isReady,
  maxAttempts = 10,
  baseDelay = 500,
  label = "executeWithRetry",
}: RetryConfig<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await apiCall();
      if (isReady(response)) return response;
      // not ready, but no error — будем ждать и пробовать снова
    } catch (err) {
      lastErr = err;
    }
    if (attempt < maxAttempts) {
      const delay =
        baseDelay *
        Math.pow(2, attempt - 1) *
        (0.5 + Math.random() * 0.5);
      await sleep(delay);
    }
  }
  throw new Error(
    `${label}: data not ready after ${maxAttempts} attempts${
      lastErr instanceof Error ? `; last error: ${lastErr.message}` : ""
    }`,
  );
}
