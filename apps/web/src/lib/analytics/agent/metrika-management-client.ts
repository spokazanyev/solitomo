/**
 * Yandex.Metrika Management API client.
 *
 * Single point of contact для agent-кода с Metrika API.
 *
 * Соответствие спеке 058:
 * - FR-361: применяет config через API
 * - FR-375: каждый вызов в AgentExecutionLog
 * - FR-384/FR-396: mutating только через legitimate MutationSource
 * - FR-391: hard-delete только с confirmationFlag
 * - FR-393: rate-limiting + backoff
 * - FR-395: circuit-breaker
 *
 * См. также:
 * - contracts/metrika-management-api.md
 * - research.md R17 (endpoints)
 */
import type { AuditLogger } from "./audit-logger.ts";
import { buildAuditEntry } from "./audit-logger.ts";
import {
  assertHardDeleteAllowed,
  CircuitBreaker,
  MetrikaAuthError,
  MetrikaError,
  MetrikaRateLimitError,
  RateLimiter,
  validateMutationSource,
} from "./safety.ts";
import type {
  MetrikaCounterSettings,
  MetrikaFilter,
  MetrikaGoal,
  MutationSource,
} from "./types.ts";

const DEFAULT_BASE_URL = "https://api-metrika.yandex.net/management/v1";
const USER_AGENT = "Soliton-AnalyticsAgent/1.0";

export interface MetrikaManagementClientConfig {
  token: string;
  counterId: string | number;
  baseUrl?: string;
  audit: AuditLogger;
  rateLimit?: { maxPerMinute?: number };
  /**
   * Если true — ни один вызов не делается реальный HTTP. Используется в dry-run.
   */
  dryRun?: boolean;
}

/**
 * Существующая Goal в Metrike (как пришло из API). Отличается от MetrikaGoal
 * наличием numeric `id`.
 */
export interface ExistingGoal {
  id: number;
  name: string;
  type: string;
  conditions?: Array<{ type: string; url: string }>;
  is_retargeting?: boolean;
  flag?: string; // "basket" | "order" | ... для display в Metrika UI
}

export interface ExistingFilter {
  id: number;
  name: string;
  attr: string;
  type: string;
  value: string;
  status?: string;
}

export class MetrikaManagementClient {
  private readonly token: string;
  private readonly counterId: string;
  private readonly baseUrl: string;
  private readonly audit: AuditLogger;
  private readonly rateLimiter: RateLimiter;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly dryRun: boolean;

  constructor(config: MetrikaManagementClientConfig) {
    if (!config.token) {
      throw new MetrikaError("MetrikaManagementClient: token is required (env YM_AGENT_TOKEN)");
    }
    if (!config.counterId) {
      throw new MetrikaError("MetrikaManagementClient: counterId is required (env YM_COUNTER_ID)");
    }
    this.token = config.token;
    this.counterId = String(config.counterId);
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.audit = config.audit;
    this.rateLimiter = new RateLimiter(config.rateLimit?.maxPerMinute ?? 100);
    this.circuitBreaker = new CircuitBreaker();
    this.dryRun = config.dryRun ?? false;
  }

  // ============================================================
  // Read-only operations (без MutationSource)
  // ============================================================

  async getCounter(): Promise<{
    id: number;
    name: string;
    site: string;
    permission: "own" | "edit" | "view" | "none";
    code_options?: Record<string, unknown>;
    webvisor?: Record<string, unknown>;
  }> {
    const response = await this.request<{ counter: any }>({
      endpoint: `/counter/${this.counterId}`,
      method: "GET",
    });
    return response.counter;
  }

  async listGoals(): Promise<ExistingGoal[]> {
    const response = await this.request<{ goals: ExistingGoal[] }>({
      endpoint: `/counter/${this.counterId}/goals`,
      method: "GET",
    });
    return response.goals ?? [];
  }

  async listFilters(): Promise<ExistingFilter[]> {
    const response = await this.request<{ filters: ExistingFilter[] }>({
      endpoint: `/counter/${this.counterId}/filters`,
      method: "GET",
    });
    return response.filters ?? [];
  }

  // ============================================================
  // Mutating operations (требуют MutationSource)
  // ============================================================

  async createGoal(goal: MetrikaGoal, source: MutationSource): Promise<{ id: number }> {
    validateMutationSource(source);

    const apiGoal = toApiGoal(goal);
    const response = await this.request<{ goal: { id: number } }>({
      endpoint: `/counter/${this.counterId}/goals`,
      method: "POST",
      body: { goal: apiGoal },
      source,
    });
    return { id: response.goal.id };
  }

  async updateGoal(
    id: number,
    patch: Partial<MetrikaGoal>,
    source: MutationSource,
  ): Promise<void> {
    validateMutationSource(source);

    const apiPatch = toApiGoal(patch as MetrikaGoal);
    await this.request({
      endpoint: `/counter/${this.counterId}/goal/${id}`,
      method: "PUT",
      body: { goal: { id, ...apiPatch } },
      source,
    });
  }

  /**
   * Soft-disable (FR-391): не hard-delete, а update enabled=false.
   * Yandex Metrika не имеет explicit enabled-флага для goals; soft-disable
   * на практике = removing all conditions, чтобы цель не срабатывала.
   * Лучшая практика — НЕ удалять, НЕ менять, оставлять как-есть; этот метод
   * используется только если goal был случайно создан и не должен срабатывать.
   *
   * В рамках MVP — этот метод resolved через update с маркером в name
   * ("[DISABLED] " prefix), что не ломает API но помечает в UI.
   */
  async softDisableGoal(id: number, originalName: string, source: MutationSource): Promise<void> {
    validateMutationSource(source);
    const disabledName = originalName.startsWith("[DISABLED] ")
      ? originalName
      : `[DISABLED] ${originalName}`;
    await this.request({
      endpoint: `/counter/${this.counterId}/goal/${id}`,
      method: "PUT",
      body: { goal: { id, name: disabledName } },
      source,
    });
  }

  /**
   * Hard-delete (FR-391): возможен только при source.kind='proposal' AND confirmationFlag.
   */
  async hardDeleteGoal(
    id: number,
    source: MutationSource & { confirmationFlag?: true },
  ): Promise<void> {
    assertHardDeleteAllowed(source);
    await this.request({
      endpoint: `/counter/${this.counterId}/goal/${id}`,
      method: "DELETE",
      source,
    });
  }

  async createFilter(filter: MetrikaFilter, source: MutationSource): Promise<{ id: number }> {
    validateMutationSource(source);

    const apiFilter = toApiFilter(filter);
    const response = await this.request<{ filter: { id: number } }>({
      endpoint: `/counter/${this.counterId}/filters`,
      method: "POST",
      body: { filter: apiFilter },
      source,
    });
    return { id: response.filter.id };
  }

  async updateFilter(
    id: number,
    patch: Partial<MetrikaFilter>,
    source: MutationSource,
  ): Promise<void> {
    validateMutationSource(source);
    const apiPatch = toApiFilter(patch as MetrikaFilter);
    await this.request({
      endpoint: `/counter/${this.counterId}/filter/${id}`,
      method: "PUT",
      body: { filter: { id, ...apiPatch } },
      source,
    });
  }

  /**
   * Update counter settings (FR-392: critical-settings, требуют proposal).
   * Каждое поле в `patch` опционально.
   */
  async updateCounterSettings(
    patch: Partial<MetrikaCounterSettings>,
    source: MutationSource,
  ): Promise<void> {
    validateMutationSource(source);

    const apiPatch: Record<string, unknown> = {};
    const codeOptions: Record<string, unknown> = {};
    const webvisor: Record<string, unknown> = {};

    if (patch.firstPartyCookies !== undefined) codeOptions.in_one_line = patch.firstPartyCookies;
    if (patch.accurateTrackBounce !== undefined) {
      codeOptions.accurate_track_bounce = patch.accurateTrackBounce;
    }
    if (patch.trackLinks !== undefined) codeOptions.track_links = patch.trackLinks;
    if (patch.clickmap !== undefined) codeOptions.clickmap = patch.clickmap;
    if (patch.informer !== undefined) codeOptions.informer = { enabled: patch.informer };

    if (patch.webvisor?.enabled !== undefined) webvisor.urls = patch.webvisor.enabled ? "" : "off";
    if (patch.webvisor?.formCapturing !== undefined) {
      webvisor.forms = patch.webvisor.formCapturing !== "disabled";
      webvisor.load_player_type = patch.webvisor.formCapturing === "enabled_with_masks" ? "v2" : "v1";
    }

    if (Object.keys(codeOptions).length > 0) apiPatch.code_options = codeOptions;
    if (Object.keys(webvisor).length > 0) apiPatch.webvisor = webvisor;

    if (Object.keys(apiPatch).length === 0) return;

    await this.request({
      endpoint: `/counter/${this.counterId}`,
      method: "PUT",
      body: { counter: apiPatch },
      source,
    });
  }

  // ============================================================
  // Internal HTTP helper
  // ============================================================

  private async request<T = unknown>(args: {
    endpoint: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: Record<string, unknown>;
    source?: MutationSource;
    timeoutMs?: number;
  }): Promise<T> {
    this.circuitBreaker.check();

    if (!this.dryRun) {
      await this.rateLimiter.checkAndRecord();
    }

    const url = `${this.baseUrl}${args.endpoint}`;
    const start = Date.now();
    let responseStatus = 0;
    let errorMessage: string | undefined;
    let responseText = "";

    if (this.dryRun && args.method !== "GET") {
      // Dry-run: НЕ делаем mutating-вызов, имитируем 200
      const durationMs = Date.now() - start;
      await this.audit.log(
        buildAuditEntry({
          endpoint: args.endpoint,
          method: args.method,
          requestParams: { body: args.body, dryRun: true },
          responseStatus: 200,
          durationMs,
          userAgent: USER_AGENT,
          source: args.source,
          responseBodySummary: "<dry-run, no actual request>",
        }),
      );
      // Return fake-ID для goal/filter creates (used in apply-config dry-run output)
      return { goal: { id: -1 }, filter: { id: -1 } } as T;
    }

    try {
      const headers: Record<string, string> = {
        Authorization: `OAuth ${this.token}`,
        "User-Agent": USER_AGENT,
      };
      if (args.body) headers["Content-Type"] = "application/json";

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), args.timeoutMs ?? 10_000);

      let response: Response;
      try {
        response = await fetch(url, {
          method: args.method,
          headers,
          body: args.body ? JSON.stringify(args.body) : undefined,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      responseStatus = response.status;
      responseText = await response.text();

      if (response.status === 401 || response.status === 403) {
        this.circuitBreaker.recordFailure();
        throw new MetrikaAuthError(
          `Metrika API ${response.status}: ${truncate(responseText, 200)}`,
        );
      }

      if (response.status === 429) {
        this.circuitBreaker.recordFailure();
        throw new MetrikaRateLimitError(
          `Metrika API 429: ${truncate(responseText, 100)}`,
        );
      }

      if (!response.ok) {
        this.circuitBreaker.recordFailure();
        errorMessage = `HTTP ${response.status}: ${truncate(responseText, 200)}`;
        throw new MetrikaError(errorMessage);
      }

      this.circuitBreaker.recordSuccess();

      const json = responseText ? (JSON.parse(responseText) as T) : ({} as T);
      return json;
    } catch (err) {
      if (!errorMessage) errorMessage = (err as Error).message;
      throw err;
    } finally {
      const durationMs = Date.now() - start;
      await this.audit.log(
        buildAuditEntry({
          endpoint: args.endpoint,
          method: args.method,
          requestParams: args.body ? { body: args.body } : undefined,
          responseStatus,
          durationMs,
          ...(errorMessage !== undefined ? { errorMessage } : {}),
          userAgent: USER_AGENT,
          ...(args.source !== undefined ? { source: args.source } : {}),
          responseBodySummary: truncate(responseText, 500),
        }),
      );
    }
  }
}

// ============================================================
// Mappers: domain types ↔ Metrika API shapes
// ============================================================

function toApiGoal(goal: Partial<MetrikaGoal>): Record<string, unknown> {
  const api: Record<string, unknown> = {};
  if (goal.name !== undefined) api.name = goal.name;
  if (goal.type !== undefined) api.type = goal.type;
  if (goal.conditions !== undefined) api.conditions = goal.conditions;
  if (goal.steps !== undefined) api.steps = goal.steps;
  if (goal.isRetargeting !== undefined) api.is_retargeting = goal.isRetargeting;
  return api;
}

function toApiFilter(filter: Partial<MetrikaFilter>): Record<string, unknown> {
  const api: Record<string, unknown> = {};
  if (filter.name !== undefined) api.name = filter.name;
  if (filter.attr !== undefined) api.attr = filter.attr;
  if (filter.type !== undefined) api.type = filter.type;
  if (filter.value !== undefined) api.value = filter.value;
  if (filter.withSubdomains !== undefined) api.with_subdomains = filter.withSubdomains;
  return api;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}...[truncated ${s.length - max}b]`;
}
