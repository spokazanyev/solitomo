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
      type: "action",
      conditions: [{ type: "exact", url: "purchase" }],
      isRetargeting: true,
      enabled: true,
      businessMeaning: "Успешная оплата заказа (главная цель для оптимизации Я.Директа)",
      owner: "svp@heado.ru",
    },
    {
      name: "Begin Checkout",
      type: "action",
      conditions: [{ type: "exact", url: "begin_checkout" }],
      isRetargeting: true,
      enabled: true,
      businessMeaning: "Пользователь начал оформление заказа",
      owner: "svp@heado.ru",
    },
    {
      name: "Add to Cart",
      type: "action",
      conditions: [{ type: "exact", url: "add_to_cart" }],
      isRetargeting: true,
      enabled: true,
      businessMeaning: "Товар добавлен в корзину",
      owner: "svp@heado.ru",
    },
    {
      name: "Payment Intent",
      type: "action",
      conditions: [{ type: "exact", url: "payment_intent" }],
      enabled: true,
      businessMeaning: "Платёж инициирован (клик 'Оплатить', до редиректа)",
      owner: "svp@heado.ru",
    },
    {
      name: "Payment Failed",
      type: "action",
      conditions: [{ type: "exact", url: "payment_failed" }],
      enabled: true,
      businessMeaning: "Оплата провалилась (по любой причине)",
      owner: "svp@heado.ru",
    },

    // === B2B / RFQ ===
    {
      name: "RFQ Submit",
      type: "action",
      conditions: [{ type: "exact", url: "rfq_submit" }],
      isRetargeting: true,
      enabled: true,
      businessMeaning: "B2B запрос на КП отправлен",
      owner: "svp@heado.ru",
    },
    {
      name: "RFQ Open",
      type: "action",
      conditions: [{ type: "exact", url: "rfq_open" }],
      enabled: true,
      businessMeaning: "Пользователь открыл форму RFQ (начал заполнять)",
      owner: "svp@heado.ru",
    },
    {
      name: "Price Request Click",
      type: "action",
      conditions: [{ type: "exact", url: "price_request_click" }],
      isRetargeting: true,
      enabled: true,
      businessMeaning: "B2B-сигнал: клик 'Запросить цену' на товаре без публичной цены",
      owner: "svp@heado.ru",
    },

    // === Контент-сигналы ===
    {
      name: "Document Download",
      type: "action",
      conditions: [{ type: "exact", url: "document_download" }],
      isRetargeting: true,
      enabled: true,
      businessMeaning: "Скачан PDF (документация / паспорт / сертификат)",
      owner: "svp@heado.ru",
    },
    {
      name: "Phone Click",
      type: "action",
      conditions: [{ type: "exact", url: "phone_click" }],
      enabled: true,
      businessMeaning: "Клик по номеру телефона",
      owner: "svp@heado.ru",
    },
    {
      name: "Email Click",
      type: "action",
      conditions: [{ type: "exact", url: "email_click" }],
      enabled: true,
      businessMeaning: "Клик по email-ссылке",
      owner: "svp@heado.ru",
    },

    // === Поиск ===
    {
      name: "Search",
      type: "action",
      conditions: [{ type: "exact", url: "search" }],
      enabled: true,
      businessMeaning: "Использован внутренний поиск по сайту",
      owner: "svp@heado.ru",
    },
    {
      name: "Search No Results",
      type: "action",
      conditions: [{ type: "exact", url: "search_no_results" }],
      enabled: true,
      businessMeaning: "Поиск дал 0 результатов (контент-сигнал)",
      owner: "svp@heado.ru",
    },
    {
      name: "Filter Apply",
      type: "action",
      conditions: [{ type: "exact", url: "filter_apply" }],
      enabled: true,
      businessMeaning: "Применён фильтр в каталоге",
      owner: "svp@heado.ru",
    },

    // === Quality micro-goal (FR-210) — DEFERRED ===
    // TODO(v1.1): Yandex Metrika type='number' goal требует поле `depth`, а не `conditions`.
    // Нужно расширить toApiGoal mapper в metrika-management-client.ts для number-type:
    //   `{ goal: { name, type: "number", depth: 2 } }`
    // После починки — раскомментировать ниже:
    // {
    //   name: "Qualified Visit",
    //   type: "number",
    //   conditions: [{ type: "exact", url: "2" }], // pseudo — реальный API ждёт `depth: 2`
    //   enabled: true,
    //   businessMeaning: "≥2 страниц за визит — micro-goal для Я.Директ оптимизации (FR-210)",
    //   owner: "svp@heado.ru",
    // },
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
   * Retargeting-сегменты — FR-200.
   *
   * DEFERRED: Yandex Metrika Filters API (`POST /counter/{id}/filters`) принимает
   * только ограниченный whitelist `attr`-значений (URL-pattern matching). Для
   * сегментации по `user_type=legal_entity` или по goal-completion (abandoned-cart,
   * купивших) нужна Yandex Audience API (api-audience.yandex.ru) — отдельный
   * продукт со своей авторизацией.
   *
   * v1.1: реализовать audience-client.ts + интегрировать в apply-config.
   * В v1 — задаются вручную через UI Я.Метрики → "Сегменты".
   */
  filters: [],

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
