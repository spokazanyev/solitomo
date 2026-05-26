/**
 * Типы для agent-driven Metrika management.
 *
 * Соответствие спеке 058:
 * - data-model.md §3.2 MetrikaConfigFile
 * - contracts/metrika-management-api.md
 * - research.md R17 (Yandex Metrika Management API endpoints)
 */

/**
 * Goal в Yandex Metrika. См. R17 endpoints `/management/v1/counter/<id>/goals`.
 *
 * Цели имеют разные `type`:
 * - `number` — N просмотров за визит (depth goal)
 * - `step` — составная цель (funnel)
 * - `url` — URL match
 * - `action` (deprecated) → `event_target` — событие из dataLayer
 *
 * В нашем v1 fokус на `event_target` (для events.ts) и `step` (для funnels).
 */
export interface MetrikaGoal {
  /**
   * Уникальный человеческий идентификатор для upsert-by-name.
   * НЕ Metrika-ID — тот appearит только после create-вызова API.
   */
  name: string;

  type: "event_target" | "step" | "url" | "number" | "phone" | "email";

  /**
   * Conditions — массив условий, при выполнении которых цель срабатывает.
   * Формат API: `[{ type: "event", url: "eventName" }]` для event_target.
   */
  conditions?: MetrikaGoalCondition[];

  /**
   * Шаги для type='step' (составной цели / funnel).
   */
  steps?: MetrikaGoalStep[];

  /**
   * Цель используется для аудиторий Я.Директа.
   */
  isRetargeting?: boolean;

  /**
   * Soft-disable вместо hard-delete (FR-391).
   */
  enabled?: boolean;

  /**
   * Бизнес-смысл — синхронизируется в goal-mapping.md после apply (FR-363).
   */
  businessMeaning: string;

  /**
   * Owner — кто отвечает за эту цель.
   */
  owner: string;
}

export interface MetrikaGoalCondition {
  type: "exact" | "contain" | "start" | "regexp" | "action" | "event";
  url: string;
}

export interface MetrikaGoalStep {
  name: string;
  conditions: MetrikaGoalCondition[];
}

/**
 * Filter в Metrika — используется как retargeting-сегмент.
 * См. R17 endpoints `/management/v1/counter/<id>/filters`.
 */
export interface MetrikaFilter {
  name: string;
  attr: string; // например 'ym:s:lastTrafficSource' или 'ym:s:UTMCampaign'
  type: "equal" | "not_equal" | "in" | "not_in" | "contain" | "not_contain" | "start" | "not_start";
  value: string;
  /**
   * Применять к поддоменам.
   */
  withSubdomains?: boolean;
  enabled?: boolean;
  /**
   * Бизнес-смысл — что измеряет этот сегмент.
   */
  businessMeaning: string;
}

/**
 * Counter Settings — настройки счётчика в Метрике.
 * Соответствует `counter.code_options` + `counter.webvisor` в API.
 *
 * Эти настройки НЕ меняются agent'ом без approve (FR-392).
 */
export interface MetrikaCounterSettings {
  /**
   * First-party cookies (FR-340, R7). Критично для Safari/ITP.
   */
  firstPartyCookies: boolean;

  /**
   * Webvisor с записью форм. FR-061-063.
   * formCapturing 'enabled_with_masks' — поля с PII маскируются через data-yandex-metrika-mask.
   */
  webvisor: {
    enabled: boolean;
    enabledV2: boolean;
    formCapturing: "disabled" | "enabled_without_data" | "enabled_with_masks";
    urlFilter?: string;
  };

  /**
   * accurateTrackBounce: true → визит ≥15 сек НЕ считается отказом.
   */
  accurateTrackBounce: boolean;

  /**
   * Карта ссылок (FR-063).
   */
  trackLinks: boolean;

  /**
   * Тепловая карта кликов.
   */
  clickmap: boolean;

  /**
   * Информер на сайте — мы НЕ используем.
   */
  informer: boolean;
}

/**
 * Основной config-as-code object. См. data-model.md §3.2.
 */
export interface MetrikaConfig {
  /**
   * Counter ID — справочно. НЕ используется для diff-сравнения
   * (это runtime-параметр, не часть конфигурации).
   */
  counterIdHint?: string;

  /**
   * Цели — FR-050.
   */
  goals: MetrikaGoal[];

  /**
   * Составные цели (funnels) — FR-051.
   */
  compositeGoals: MetrikaGoal[];

  /**
   * Filters / retargeting-сегменты — FR-200.
   */
  filters: MetrikaFilter[];

  /**
   * Counter Settings — FR-340, FR-061-063.
   */
  counterSettings: MetrikaCounterSettings;
}

/**
 * MutationSource — обязательный параметр для всех mutating-методов API client.
 * Это и есть FR-396 invariant enforcement на типовом уровне.
 *
 * См. contracts/metrika-management-api.md §«Mutating operations».
 */
export type MutationSource =
  | { kind: "proposal"; proposalId: string }
  | { kind: "config_apply"; runId: string }
  | { kind: "manual_admin"; adminUserId: string };

/**
 * Результат diff между metrika.config.ts и live state Метрики.
 * Используется в apply-config и validate-config.
 */
export interface ConfigDiff {
  goalsToCreate: MetrikaGoal[];
  goalsToUpdate: Array<{ existing: { id: number; name: string }; updated: MetrikaGoal }>;
  goalsOrphan: Array<{ id: number; name: string }>; // в Metrika но нет в config — soft-disable candidates
  filtersToCreate: MetrikaFilter[];
  filtersToUpdate: Array<{ existing: { id: number; name: string }; updated: MetrikaFilter }>;
  filtersOrphan: Array<{ id: number; name: string }>;
  counterSettingsPatch: Partial<MetrikaCounterSettings> | null;
}
