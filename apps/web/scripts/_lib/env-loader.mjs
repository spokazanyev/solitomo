/**
 * Minimal .env.local loader для CLI-скриптов.
 *
 * Без dotenv-зависимости. Парсит KEY=value, поддерживает:
 * - Пустые строки и комментарии (#)
 * - Кавычки (" и ') вокруг значения
 * - export KEY=value
 *
 * НЕ поддерживает: variable interpolation ($VAR), multi-line values.
 *
 * Загружает в process.env (если уже не установлены — env-vars priority над .env.local).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * @param {string} envPath - путь к .env.local
 * @returns {Record<string, string>} - распарсенные переменные
 */
export function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return {};
  }

  const content = readFileSync(envPath, "utf-8");
  const parsed = {};

  for (const rawLine of content.split("\n")) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("export ")) line = line.slice(7).trim();

    const eq = line.indexOf("=");
    if (eq < 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Strip inline comments (only if value не в кавычках)
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const hashIdx = value.indexOf(" #");
      if (hashIdx > 0) value = value.slice(0, hashIdx).trim();
    }

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;

    // Only set in process.env if not already set (priority: real env > .env.local)
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return parsed;
}

/**
 * Load .env.local from apps/web/ (default location).
 * Returns parsed vars; also injects into process.env.
 *
 * @param {string} appWebDir - абсолютный путь к apps/web
 */
export function loadAppEnv(appWebDir) {
  const envLocal = path.join(appWebDir, ".env.local");
  const env = path.join(appWebDir, ".env");

  // .env first (defaults), then .env.local overrides
  const baseEnv = loadEnvFile(env);
  const localEnv = loadEnvFile(envLocal);

  return { ...baseEnv, ...localEnv };
}

/**
 * Throws if required vars missing or empty.
 *
 * @param {string[]} required
 */
export function assertEnv(required) {
  const missing = required.filter((k) => !process.env[k] || process.env[k].trim() === "");
  if (missing.length > 0) {
    throw new Error(
      `Missing required env variables:\n  ${missing.join("\n  ")}\n\n` +
        `Add them to apps/web/.env.local (see .env.example for reference).`,
    );
  }
}
