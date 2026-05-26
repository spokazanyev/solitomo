/**
 * Env-marker для analytics events (FR-270, FR-271).
 *
 * Каждое событие в dataLayer должно содержать `env` параметр чтобы:
 * - prod-аналитика не загрязнялась dev/staging трафиком (FR-271);
 * - суточная проверка (FR-272, v1.2) могла поднять алерт при protectorate'е
 *   утечке.
 *
 * Источники priority (highest → lowest):
 * 1. `NEXT_PUBLIC_DEPLOYMENT_ENV` env-переменная (explicit override)
 * 2. `process.env.NODE_ENV` ('production' / 'development' / 'test')
 * 3. fallback 'development'
 */

export type Environment = "production" | "staging" | "development";

export function getEnvironment(): Environment {
  const explicit = (
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_DEPLOYMENT_ENV : undefined
  )?.toLowerCase();

  if (explicit === "production" || explicit === "staging" || explicit === "development") {
    return explicit;
  }

  const nodeEnv = typeof process !== "undefined" ? process.env.NODE_ENV : undefined;
  if (nodeEnv === "production") return "production";

  return "development";
}
