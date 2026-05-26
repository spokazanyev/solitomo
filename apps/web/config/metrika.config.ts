/**
 * Metrika Config-as-code — single source of truth для Metrika-конфигурации.
 *
 * Соответствие спеке 058:
 * - FR-360: source of truth, git-tracked
 * - FR-361: применяется через `pnpm metrika:apply-config`
 * - FR-363: goal-mapping.md auto-update после apply
 *
 * Принципы:
 * - Идентичность объектов через `name` (не numeric ID — он output API)
 * - `enabled: false` = soft-disable, hard-delete только через AgentProposal
 * - Удалить из config = не означает hard-delete в Metrike (FR-391)
 *
 * События, на которые ставятся цели — определены в:
 * - apps/web/src/lib/analytics/events.ts (event-helpers)
 * - apps/web/src/lib/analytics/data-layer.ts (ecommerce)
 * - specs/058-behavior-and-ad-analytics/contracts/analytics-events.md
 */
import type { MetrikaConfig } from "../src/lib/analytics/agent/types.ts";

export const metrikaConfig: MetrikaConfig = {
  // Counter ID = 109422539 (pdumarket.ru) — справочно; реальный ID берётся из env
  counterIdHint: "109422539",

  /**
   * v1 цели — FR-050.
   * Соответствие spec.md `## Functional Requirements — Цели Метрики и воронки`.
   */
  goals: [
    // === Основные конверсии (Покупка) ===
    {
      name: "Purchase",
      type: "event_target",
      conditions: [{ type: "event", url: "purchase" }],
      isRetargeting: true,
      enabled: true,
      businessMeaning: "Успешная оплата заказа (главная цель для оптимизации Я.Директа)",
      owner: "svp@heado.ru",
    },
    {
      name: "Begin Checkout",
      type: "event_target",
      conditions: [{ type: "event", url: "begin_checkout" }],
      isRetargeting: true,
      enabled: true,
      businessMeaning: "Пользователь начал оформление заказа",
      owner: "svp@heado.ru",
    },
    {
      name: "Add to Cart",
      type: "event_target",
      conditions: [{ type: "event", url: "add_to_cart" }],
      isRetargeting: true,
      enabled: true,
      businessMeaning: "Товар добавлен в корзину",
      owner: "svp@heado.ru",
    },
    {
      name: "Payment Intent",
      type: "event_target",
      conditions: [{ type: "event", url: "payment_intent" }],
      enabled: true,
      businessMeaning: "Платёж инициирован (клик 'Оплатить', до редиректа)",
      owner: "svp@heado.ru",
    },
    {
      name: "Payment Failed",
      type: "event_target",
      conditions: [{ type: "event", url: "payment_failed" }],
      enabled: true,
      businessMeaning: "Оплата провалилась (по любой причине)",
      owner: "svp@heado.ru",
    },

    // === B2B / RFQ ===
    {
      name: "RFQ Submit",
      type: "event_target",
      conditions: [{ type: "event", url: "rfq_submit" }],
      isRetargeting: true,
      enabled: true,
      businessMeaning: "B2B запрос на КП отправлен",
      owner: "svp@heado.ru",
    },
    {
      name: "RFQ Open",
      type: "event_target",
      conditions: [{ type: "event", url: "rfq_open" }],
      enabled: true,
      businessMeaning: "Пользователь открыл форму RFQ (начал заполнять)",
      owner: "svp@heado.ru",
    },
    {
      name: "Price Request Click",
      type: "event_target",
      conditions: [{ type: "event", url: "price_request_click" }],
      isRetargeting: true,
      enabled: true,
      businessMeaning: "B2B-сигнал: клик 'Запросить цену' на товаре без публичной цены",
      owner: "svp@heado.ru",
    },

    // === Контент-сигналы ===
    {
      name: "Document Download",
      type: "event_target",
      conditions: [{ type: "event", url: "document_download" }],
      isRetargeting: true,
      enabled: true,
      businessMeaning: "Скачан PDF (документация / паспорт / сертификат)",
      owner: "svp@heado.ru",
    },
    {
      name: "Phone Click",
      type: "event_target",
      conditions: [{ type: "event", url: "phone_click" }],
      enabled: true,
      businessMeaning: "Клик по номеру телефона",
      owner: "svp@heado.ru",
    },
    {
      name: "Email Click",
      type: "event_target",
      conditions: [{ type: "event", url: "email_click" }],
      enabled: true,
      businessMeaning: "Клик по email-ссылке",
      owner: "svp@heado.ru",
    },

    // === Поиск ===
    {
      name: "Search",
      type: "event_target",
      conditions: [{ type: "event", url: "search" }],
      enabled: true,
      businessMeaning: "Использован внутренний поиск по сайту",
      owner: "svp@heado.ru",
    },
    {
      name: "Search No Results",
      type: "event_target",
      conditions: [{ type: "event", url: "search_no_results" }],
      enabled: true,
      businessMeaning: "Поиск дал 0 результатов (контент-сигнал)",
      owner: "svp@heado.ru",
    },
    {
      name: "Filter Apply",
      type: "event_target",
      conditions: [{ type: "event", url: "filter_apply" }],
      enabled: true,
      businessMeaning: "Применён фильтр в каталоге",
      owner: "svp@heado.ru",
    },

    // === Quality micro-goal (FR-210) ===
    {
      name: "Qualified Visit",
      type: "number", // depth goal: ≥2 страниц за визит
      conditions: [{ type: "exact", url: "2" }], // depth ≥ 2
      enabled: true,
      businessMeaning: "Качественный визит: ≥30 сек И ≥2 страниц И не bounce — micro-goal для Я.Директ оптимизации (FR-210)",
      owner: "svp@heado.ru",
    },
  ],

  /**
   * Составные цели (funnels) — FR-051.
   * Будут добавлены позже через apply-config — Yandex Metrika требует
   * существующих goal-ID для шагов, поэтому compositeGoals применяются
   * во второй pass после создания базовых goals.
   */
  compositeGoals: [
    // Phase 1: создание базовых goals в первый run.
    // Phase 2 (v1.1): после того как goal-mapping.md заполнен реальными ID,
    // здесь появятся `step`-цели «Покупка детальная» и др.
    // В v1 MVP — оставляем пустым; funnel-отчёты Метрики формируются
    // самостоятельно из event-данных через UI.
  ],

  /**
   * Retargeting-сегменты (filters) — FR-200.
   * v1: 3 обязательных сегмента; остальные 5 — v1.1 через AgentProposals.
   */
  filters: [
    {
      name: "Юрлицо (legal_entity)",
      attr: "ym:s:paramsLevel1", // user_type параметр (через ParamsLevelN)
      type: "equal",
      value: "legal_entity",
      enabled: true,
      businessMeaning: "B2B-сегмент для отдельного ретаргетинга и анализа конверсий",
    },
    {
      name: "Добавил в корзину, не купил (7d)",
      attr: "ym:s:goal", // через достижение goal
      type: "equal",
      value: "Add to Cart", // имя goal — будет заменено на ID после первого apply
      enabled: true,
      businessMeaning: "Abandoned-cart аудитория для ретаргетинга в Я.Директе (окно 7 дней)",
    },
    {
      name: "Совершил покупку за 90 дней",
      attr: "ym:s:goal",
      type: "equal",
      value: "Purchase",
      enabled: true,
      businessMeaning: "LTV-аудитория для upsell/cross-sell кампаний",
    },
  ],

  /**
   * Counter Settings — FR-340 (first-party cookies), FR-061-063 (webvisor + privacy).
   * Эти настройки требуют explicit approve через AgentProposal для изменения (FR-392),
   * но первый apply-config создаёт их из config — это начальная конфигурация.
   */
  counterSettings: {
    firstPartyCookies: true, // FR-340 — обязательно для Safari/ITP
    webvisor: {
      enabled: true, // FR-061
      enabledV2: true,
      formCapturing: "enabled_with_masks", // FR-060 — поля с PII маскируются
    },
    accurateTrackBounce: true, // визит ≥15 сек НЕ отказ
    trackLinks: true, // FR-063 — карта ссылок
    clickmap: true, // карта кликов
    informer: false,
  },
};
