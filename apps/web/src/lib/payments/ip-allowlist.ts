import "server-only";

/**
 * IP-allowlist для входящих webhook'ов ЮKassa (055 FR-5530).
 *
 * Source of truth: https://yookassa.ru/developers/using-api/webhooks#ip
 * Sync date: 2026-05 (research.md R6).
 *
 * Реализация без зависимостей — CIDR-matcher для IPv4 + IPv6.
 */

const YOOKASSA_CIDRS_V4 = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.154.128/25",
  "77.75.156.11/32",
  "77.75.156.35/32",
] as const;

const YOOKASSA_CIDRS_V6 = ["2a02:5180::/32"] as const;

interface ParsedCidrV4 {
  network: number;
  mask: number;
  prefix: number;
}

interface ParsedCidrV6 {
  network: bigint;
  mask: bigint;
  prefix: number;
}

const parsedV4: ParsedCidrV4[] = YOOKASSA_CIDRS_V4.map(parseCidrV4);
const parsedV6: ParsedCidrV6[] = YOOKASSA_CIDRS_V6.map(parseCidrV6);

/**
 * Проверяет, входит ли IP в ЮKassa-allowlist (FR-5530).
 *
 * Принимает IP в форматах:
 *   - IPv4: "185.71.76.5"
 *   - IPv4-mapped IPv6: "::ffff:185.71.76.5"
 *   - IPv6: "2a02:5180:1234::1"
 *
 * Возвращает false для пустых/невалидных значений.
 */
export function isIpInYooKassaAllowlist(ip: string | null | undefined): boolean {
  if (!ip || typeof ip !== "string") return false;
  const trimmed = ip.trim();
  if (!trimmed) return false;

  // Strip IPv4-mapped IPv6 prefix
  const v4Mapped = trimmed.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const v4Candidate = v4Mapped ? v4Mapped[1] : trimmed;

  if (isIpv4Format(v4Candidate)) {
    const num = ipv4ToInt(v4Candidate);
    if (num == null) return false;
    // JS bitwise ops are signed 32-bit — normalize with >>> 0 to compare as unsigned
    return parsedV4.some((cidr) => ((num & cidr.mask) >>> 0) === cidr.network);
  }

  if (isIpv6Format(trimmed)) {
    const num = ipv6ToBigint(trimmed);
    if (num == null) return false;
    return parsedV6.some((cidr) => (num & cidr.mask) === cidr.network);
  }

  return false;
}

// --- IPv4 helpers ---

function isIpv4Format(ip: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    num = (num << 8) | n;
  }
  // Force unsigned 32-bit (>>> 0 trick)
  return num >>> 0;
}

function parseCidrV4(cidr: string): ParsedCidrV4 {
  const [addr, prefixStr] = cidr.split("/");
  const prefix = Number(prefixStr);
  if (!addr || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid CIDR: ${cidr}`);
  }
  const num = ipv4ToInt(addr);
  if (num == null) throw new Error(`Invalid IPv4 in CIDR: ${cidr}`);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { network: (num & mask) >>> 0, mask, prefix };
}

// --- IPv6 helpers ---

function isIpv6Format(ip: string): boolean {
  // crude but sufficient: contains ":" and only hex/digits/colons
  return ip.includes(":") && /^[0-9a-fA-F:]+$/.test(ip);
}

function ipv6ToBigint(ip: string): bigint | null {
  // Expand "::" abbreviation
  let groups: string[];
  if (ip.includes("::")) {
    const [head, tail] = ip.split("::");
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    const missing = 8 - headParts.length - tailParts.length;
    if (missing < 0) return null;
    groups = [
      ...headParts,
      ...Array<string>(missing).fill("0"),
      ...tailParts,
    ];
  } else {
    groups = ip.split(":");
  }
  if (groups.length !== 8) return null;
  let num = BigInt(0);
  const SHIFT_16 = BigInt(16);
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    num = (num << SHIFT_16) | BigInt(parseInt(g, 16));
  }
  return num;
}

function parseCidrV6(cidr: string): ParsedCidrV6 {
  const [addr, prefixStr] = cidr.split("/");
  const prefix = Number(prefixStr);
  if (!addr || !Number.isInteger(prefix) || prefix < 0 || prefix > 128) {
    throw new Error(`Invalid CIDR: ${cidr}`);
  }
  const num = ipv6ToBigint(addr);
  if (num == null) throw new Error(`Invalid IPv6 in CIDR: ${cidr}`);
  const ONE = BigInt(1);
  const ZERO = BigInt(0);
  const SHIFT_128 = BigInt(128);
  const mask = prefix === 0 ? ZERO : ((ONE << SHIFT_128) - ONE) ^ ((ONE << BigInt(128 - prefix)) - ONE);
  return { network: num & mask, mask, prefix };
}

/**
 * Извлекает реальный IP клиента из webhook-запроса.
 * Учитывает proxy headers (Cloudflare → Vercel → upstream).
 *
 * Никогда не возвращает значения из `x-forwarded-for` без проверки `TRUST_PROXY_HEADERS`
 * (паттерн 054 trusted-proxy).
 */
export function extractClientIp(headers: Headers): string | null {
  // Cloudflare и Vercel — trusted unconditionally (FR-5530)
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp && cfIp.trim()) return cfIp.trim();

  const vercelIp = headers.get("x-vercel-forwarded-for");
  if (vercelIp && vercelIp.trim()) return vercelIp.split(",")[0]?.trim() ?? null;

  // x-real-ip — обычно от nginx/Vercel
  const realIp = headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();

  // x-forwarded-for — только при явном TRUST_PROXY_HEADERS=true (паттерн 054)
  if (process.env.TRUST_PROXY_HEADERS === "true") {
    const xff = headers.get("x-forwarded-for");
    if (xff && xff.trim()) return xff.split(",")[0]?.trim() ?? null;
  }

  return null;
}

/** Used for tests + observability. */
export const YOOKASSA_ALLOWLIST = {
  v4: YOOKASSA_CIDRS_V4,
  v6: YOOKASSA_CIDRS_V6,
} as const;
