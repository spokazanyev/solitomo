"use client";

import { Receipt } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AddressForm, type AddressFormValue } from "@/components/checkout/AddressForm";
import { CompanySuggestInput } from "@/components/checkout/CompanySuggestInput";
import { DadataSuggestInput } from "@/components/checkout/DadataSuggestInput";
import { DeliveryBlock, type SelectedRate } from "@/components/checkout/DeliveryBlock";
import { PhoneInput } from "@/components/checkout/PhoneInput";
import { OrderSummaryCard } from "@/components/cart/OrderSummaryCard";
import { clearCartItems, getCartTotal, useRfqCartItems } from "@/components/rfq/RfqCart";
import { pushEvent } from "@/lib/analytics/data-layer";
import {
  type ShippingMode,
  trackCompanySelected,
  trackCompanyStatusWarning,
  trackInnValidationFailed,
  trackInnValidationSuccess,
  trackShippingModeChanged,
} from "@/lib/analytics/events";
import { isValidInn } from "@/lib/dadata/inn";
import type { CompanyRequisites } from "@/lib/dadata/party-normalize";

const RISKY_STATUS_TEXT: Record<"LIQUIDATING" | "LIQUIDATED" | "BANKRUPT", string> = {
  LIQUIDATED: "Организация ликвидирована",
  LIQUIDATING: "Организация в процессе ликвидации",
  BANKRUPT: "В отношении организации введена процедура банкротства",
};

export function InvoiceCheckoutForm() {
  const items = useRfqCartItems();
  const { total, knownCount, unknownCount } = getCartTotal(items);
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [inn, setInn] = useState("");
  const [kpp, setKpp] = useState("");
  const [ogrn, setOgrn] = useState("");
  const [legalAddress, setLegalAddress] = useState("");
  // 063: отдельный state поля-поиска организации — независим от companyName,
  // чтобы очистка поиска не затирала уже заполненные реквизиты (US3 AC3).
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyStatus, setCompanyStatus] = useState<CompanyRequisites["status"]>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // 062 T022/T023/T029/T034: unified shipping-mode-selection.
  // Default — "apiship" (наиболее частый кейс, FR-062-03).
  const [shippingMode, setShippingMode] = useState<ShippingMode>("apiship");
  const [address, setAddress] = useState<AddressFormValue>({ query: "" });
  const [selectedRate, setSelectedRate] = useState<SelectedRate | null>(null);
  const [ownCarrierNote, setOwnCarrierNote] = useState("");
  const [pickupNote, setPickupNote] = useState("");
  // 062 T034: ref-flag для отслеживания, редактировал ли пользователь pickupNote
  // вручную. Auto-fill (T035) больше не должен затирать ручной ввод.
  const pickupNoteEditedRef = useRef(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  // SSR-safe lazy initialization of cart id (зеркалит PhysicalCheckoutForm).
  // Используется DeliveryBlock'ом для серверных calc-кэшей.
  const [cartId] = useState<string>(() => {
    if (typeof window === "undefined") return "anon";
    let id = window.localStorage.getItem("soliton-cart-id");
    if (!id) {
      id = `cart_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      window.localStorage.setItem("soliton-cart-id", id);
    }
    return id;
  });

  const itemsForShipping = useMemo(
    () =>
      items.map((item) => ({
        sku: item.sku,
        quantity: Number.parseInt(item.quantity, 10) || 1,
        price: item.price ?? 0,
      })),
    [items],
  );

  // 057 follow-up: the submit button must reflect actual readiness, not just
  // the consent checkbox. Required fields per the markup (`required` attr):
  // companyName, inn (10-12 digits), fullName, email.
  // Phone is optional on the invoice form; only validate when present.
  const phoneOk = phone.trim().length === 0 || /^[+0-9\s()-]{6,}$/.test(phone);
  const baseLegalReady =
    companyName.trim().length > 0 &&
    isValidInn(inn.trim()) &&
    fullName.trim().length > 0 &&
    /.+@.+\..+/.test(email.trim()) &&
    phoneOk &&
    consent;

  // 062 T025/T031/T037: per-mode readiness gates.
  let modeReady = false;
  if (shippingMode === "apiship") {
    modeReady = address.isValid === true && selectedRate !== null;
  } else if (shippingMode === "own_carrier") {
    modeReady = ownCarrierNote.trim().length >= 10;
  } else {
    // pickup
    modeReady = pickupNote.trim().length >= 5;
  }

  const isLegalReady = baseLegalReady && modeReady;

  // 063 T011: показываем ошибку контрольной суммы только при «завершённой» длине
  // 10/12 (FR-008) — частичный ввод не «ругаем».
  const innTrimmed = inn.trim();
  const innChecksumError =
    (innTrimmed.length === 10 || innTrimmed.length === 12) && !isValidInn(innTrimmed);

  useEffect(() => {
    if (items.length === 0) return;
    pushEvent("add_shipping_info", { checkout_type: "legal" });
    // 058 T031: явные checkout-step-events (FR-121, FR-122) — single-page форма,
    // блоки видны сразу при render не-пустой корзины.
    // 062 T028: добавляем shipping_mode в checkout_step_shipping payload.
    pushEvent("checkout_step_shipping", {
      step_index: 2,
      checkout_type: "legal",
      shipping_mode: shippingMode,
    });
    pushEvent("checkout_step_payment_method", { step_index: 3, checkout_type: "legal" });
    // shippingMode намеренно НЕ входит в deps — это срабатывает на появлении
    // корзины (items.length), shipping_mode — снапшот текущего mode на момент
    // первого видимого блока. Track-events для смены mode идут через
    // trackShippingModeChanged (T039), а не через этот эффект.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // 062 T035: auto-fill pickupNote из ФИО+телефон при переключении в pickup,
  // если пользователь ещё не редактировал поле вручную.
  useEffect(() => {
    if (shippingMode !== "pickup") return;
    if (pickupNoteEditedRef.current) return;
    const fio = fullName.trim();
    const tel = phone.trim();
    if (fio && tel) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPickupNote(`${fio}, тел. ${tel}`);
    }
  }, [shippingMode, fullName, phone]);

  // 058 T031: checkout_step_contact (FR-120) при первом focus в блок контактов
  const contactStepFiredRef = useRef(false);
  const handleContactFocus = () => {
    if (contactStepFiredRef.current) return;
    contactStepFiredRef.current = true;
    pushEvent("checkout_step_contact", { step_index: 1, checkout_type: "legal" });
  };

  // 058 T031: inn_validation_success/failed (FR-192) на blur или при валидном паттерне.
  // ИНН — 10 или 12 цифр. Валидируем при изменении: при достижении 10/12 — success,
  // если ввод НЕ-цифровой OR частичный — пропускаем (не спамим failure до blur).
  const innValidationFiredRef = useRef<"success" | "failed" | null>(null);
  const handleInnBlur = () => {
    const trimmed = inn.trim();
    if (trimmed.length === 0) return; // пустой — не отслеживаем
    const isValid = isValidInn(trimmed);
    const result = isValid ? "success" : "failed";
    // Anti-double-fire — повторяем только при смене результата
    if (innValidationFiredRef.current === result) return;
    innValidationFiredRef.current = result;
    if (isValid) {
      trackInnValidationSuccess({ formType: "checkout_legal" });
    } else {
      let errorCode: string;
      if (!/^[0-9]+$/.test(trimmed)) {
        errorCode = "inn_non_numeric";
      } else if (trimmed.length !== 10 && trimmed.length !== 12) {
        errorCode = "inn_wrong_length";
      } else {
        errorCode = "inn_checksum";
      }
      trackInnValidationFailed({ formType: "checkout_legal", errorCode });
    }
  };

  // 063 T008/T012: выбор организации из подсказок DaData. Безусловно перезаписывает
  // все 5 полей (overwrite-on-reselect, FR-005 exception / Q2), сбрасывает анти-дубль
  // INN-события и эмитит company_selected (+ company_status_warning при риске).
  const handleCompanySelect = (req: CompanyRequisites) => {
    setCompanyName(req.companyName);
    setInn(req.inn);
    setKpp(req.kpp);
    setOgrn(req.ogrn);
    setLegalAddress(req.legalAddress);
    setCompanyQuery(req.companyName);
    setCompanyStatus(req.status);
    innValidationFiredRef.current = null;
    trackCompanySelected({
      formType: "checkout_legal",
      hasKpp: req.kpp.length > 0,
      hasLegalAddress: req.legalAddress.length > 0,
    });
    if (req.isRisky && req.status) {
      trackCompanyStatusWarning({ formType: "checkout_legal", status: req.status });
    }
  };

  // 062 T033/T039/T040: смена режима доставки.
  // Silent reset: при уходе с apiship — гасим selectedRate (адрес остаётся, FR-062-11 Q2).
  // Заметки own_carrier/pickup НЕ сбрасываем — пользователь может вернуться, и текст останется.
  // trackShippingModeChanged стреляет ТОЛЬКО на явный клик (defensive guard ниже).
  const handleModeChange = (newMode: ShippingMode) => {
    const previousMode = shippingMode;
    if (previousMode === newMode) return;
    setShippingMode(newMode);
    if (newMode !== "apiship") {
      setSelectedRate(null);
    }
    trackShippingModeChanged({ mode: newMode, checkoutType: "legal", previousMode });
  };

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <h2 className="text-2xl font-semibold text-slate-950">Корзина пуста</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Добавьте позиции, прежде чем выписывать счёт.</p>
        <Link
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          href="/catalog/pdu/"
        >
          Открыть каталог
        </Link>
      </section>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    // 058 T031: checkout_cta_pay_clicked (FR-124) — фиксируем намерение перед validation
    pushEvent("checkout_cta_pay_clicked", {
      step_index: 5,
      checkout_type: "legal",
      value: total,
      currency: "RUB",
    });
    setError(null);
    setSubmitting(true);

    try {
      // 062 T026/T032/T038: per-mode delivery payload.
      let deliveryPayload: Record<string, unknown>;
      if (shippingMode === "apiship") {
        if (!selectedRate) {
          throw new Error("Выберите способ доставки.");
        }
        if (!address.isValid) {
          throw new Error("Выберите адрес из подсказок DaData.");
        }
        const rate = selectedRate.rate;
        deliveryPayload = {
          // 064: явный канал (service) вместо method=providerKey
          channel: "service",
          city: address.city,
          address: address.query,
          provider: rate.providerKey?.startsWith("fallback_") ? "fallback" : "apiship",
          providerKey: rate.providerKey,
          providerName: rate.providerName,
          tariffId: rate.tariffId,
          deliveryType: String(rate.deliveryType),
          pickupType: String(rate.pickupType),
          pointId: selectedRate.pointId,
          pointAddress: selectedRate.pointAddress,
          cost: rate.cost,
          etaMinDays: rate.etaMinDays,
          etaMaxDays: rate.etaMaxDays,
          addressNormalized: {
            postalCode: address.postalCode,
            city: address.city,
            region: address.region,
            street: address.street,
            house: address.house,
            flat: address.flat,
            kladrId: address.kladrId,
            fiasId: address.fiasId,
            isValid: address.isValid,
          },
        };
      } else if (shippingMode === "own_carrier") {
        deliveryPayload = {
          channel: "own_carrier",
          cost: 0,
          handoverNote: ownCarrierNote.trim(),
        };
      } else {
        // pickup
        deliveryPayload = {
          channel: "pickup",
          cost: 0,
          handoverNote: pickupNote.trim(),
        };
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "legal",
          items: items.map((item) => ({
            sku: item.sku,
            name: item.name,
            slug: item.slug,
            quantity: Number.parseInt(item.quantity, 10) || 1,
            price: item.price ?? null,
          })),
          customer: {
            fullName,
            email,
            phone,
            companyName,
            inn,
            kpp,
            ogrn,
            legalAddress,
          },
          delivery: deliveryPayload,
          sourcePage: typeof window !== "undefined" ? window.location.pathname : undefined,
          // 057 FR-5735: send the actual checkbox state (not a literal true)
          // so the server-side 152-ФЗ gate can reject the request when the
          // box was never ticked.
          consent,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Не удалось создать заказ");
      }

      const data = (await res.json()) as { id: string; publicToken?: string };

      pushEvent("invoice_requested", {
        order_id: data.id,
        value: total,
        currency: "RUB",
        items: items.map((item) => ({
          item_id: item.sku,
          item_name: item.name,
          quantity: Number.parseInt(item.quantity, 10) || 1,
          price: item.price ?? undefined,
        })),
      });

      clearCartItems();
      router.push(`/cart/order/${data.publicToken ?? data.id}/?type=invoice`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка отправки");
      setSubmitting(false);
    }
  }

  // 062 T027: OrderSummaryCard delivery line — только в ApiShip-режиме.
  const summaryDeliveryProps =
    shippingMode === "apiship"
      ? {
          showDeliveryLine: true as const,
          deliveryCost: selectedRate
            ? selectedRate.rate.providerKey === "pickup"
              ? 0
              : selectedRate.rate.cost
            : null,
          deliveryLabel: selectedRate?.rate.providerName ?? selectedRate?.rate.providerKey,
        }
      : {};

  return (
    <form className="grid gap-8 lg:grid-cols-[1fr_360px]" onSubmit={handleSubmit}>
      <section className="grid gap-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Receipt className="h-4 w-4 text-sky-700" />
            Реквизиты юрлица
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <CompanySuggestInput
                label="Найти организацию по названию или ИНН"
                placeholder="Например: Ромашка или 7707083893"
                value={companyQuery}
                onQueryChange={setCompanyQuery}
                onSelect={handleCompanySelect}
              />
            </div>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Наименование компании *
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                onChange={(event) => setCompanyName(event.target.value)}
                required
                type="text"
                value={companyName}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              ИНН *
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                inputMode="numeric"
                data-yandex-metrika-mask="true"
                onBlur={handleInnBlur}
                onChange={(event) => setInn(event.target.value)}
                pattern="[0-9]{10,12}"
                required
                type="text"
                value={inn}
              />
              {innChecksumError ? (
                <span role="alert" className="text-xs font-medium text-rose-700">
                  Проверьте ИНН — некорректная контрольная сумма
                </span>
              ) : null}
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              КПП
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                inputMode="numeric"
                onChange={(event) => setKpp(event.target.value)}
                type="text"
                value={kpp}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              ОГРН
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                inputMode="numeric"
                onChange={(event) => setOgrn(event.target.value)}
                type="text"
                value={ogrn}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600 md:col-span-2">
              Юридический адрес
              <textarea
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                onChange={(event) => setLegalAddress(event.target.value)}
                rows={2}
                value={legalAddress}
              />
            </label>
          </div>
          {companyStatus === "LIQUIDATING" ||
          companyStatus === "LIQUIDATED" ||
          companyStatus === "BANKRUPT" ? (
            <p
              role="alert"
              className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
            >
              ⚠ {RISKY_STATUS_TEXT[companyStatus]}. Проверьте контрагента перед оформлением.
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6" onFocus={handleContactFocus}>
          <p className="text-sm font-semibold text-slate-950">Контактное лицо</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <DadataSuggestInput
              kind="fio"
              label="ФИО"
              required
              autoComplete="name"
              value={fullName}
              onChange={(next) => setFullName(next)}
            />
            <DadataSuggestInput
              kind="email"
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(next) => setEmail(next)}
            />
            <PhoneInput label="Телефон" value={phone} onChange={setPhone} />
          </div>
        </div>

        {/* 062 T022: 3-radio mode selector заменяет хардкод-<select>. */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-950">Доставка</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Выберите способ доставки. Если оплата картой невозможна — менеджер уточнит.
          </p>
          <div
            className="mt-4 grid gap-2 md:grid-cols-3"
            role="radiogroup"
            aria-label="Способ доставки"
          >
            {(
              [
                { value: "pickup", label: "Самовывоз" },
                { value: "apiship", label: "Через службу доставки" },
                { value: "own_carrier", label: "Транспортной компанией покупателя" },
              ] as Array<{ value: ShippingMode; label: string }>
            ).map((option) => {
              const checked = shippingMode === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${
                    checked
                      ? "border-sky-600 bg-sky-50 text-slate-950"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <input
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-sky-600"
                    type="radio"
                    name="shippingMode"
                    value={option.value}
                    checked={checked}
                    onChange={() => handleModeChange(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>

          {/* 062 T024: ApiShip — AddressForm + DeliveryBlock. */}
          {shippingMode === "apiship" && (
            <>
              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6">
                <p className="text-sm font-semibold text-slate-950">Адрес</p>
                <div className="mt-4">
                  <AddressForm value={address} onChange={setAddress} />
                  {address.isValid && (
                    <p className="mt-2 text-xs text-emerald-700">
                      Адрес подтверждён DaData
                      {address.postalCode ? ` · индекс ${address.postalCode}` : ""}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <DeliveryBlock
                  cartId={cartId}
                  items={itemsForShipping}
                  onSelect={setSelectedRate}
                  address={address}
                />
              </div>
            </>
          )}

          {/* 062 T030: own_carrier — обязательная заметка (≥10 симв). */}
          {shippingMode === "own_carrier" && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6">
              <label className="grid gap-1 text-xs font-medium text-slate-600">
                Уточнение по отгрузке *
                <textarea
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                  rows={3}
                  maxLength={1000}
                  required
                  value={ownCarrierNote}
                  onChange={(event) => setOwnCarrierNote(event.target.value)}
                  placeholder="Название ТК, номер договора, контакт водителя/менеджера. Например: ПЭК, договор № 4567 от 12.01.2025, +7 999 123-45-67"
                />
                <span className="text-[10px] text-slate-500">{ownCarrierNote.length}/1000 символов</span>
              </label>
            </div>
          )}

          {/* 062 T036: pickup — обязательное «кто заберёт» (≥5 симв). */}
          {shippingMode === "pickup" && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6">
              <label className="grid gap-1 text-xs font-medium text-slate-600">
                Кто заберёт (ФИО + телефон) / комментарий *
                <textarea
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                  rows={3}
                  maxLength={1000}
                  required
                  value={pickupNote}
                  onChange={(event) => {
                    pickupNoteEditedRef.current = true;
                    setPickupNote(event.target.value);
                  }}
                  placeholder="Иванов Иван Иванович, тел. +7 999 123-45-67"
                />
                <span className="text-[10px] text-slate-500">{pickupNote.length}/1000 символов</span>
              </label>
            </div>
          )}
        </div>
      </section>

      {/* 061: унифицированная sidebar-сводка заказа. 062 T027: showDeliveryLine только в ApiShip. */}
      <OrderSummaryCard
        items={items}
        total={total}
        knownCount={knownCount}
        unknownCount={unknownCount}
        {...summaryDeliveryProps}
        ctaIcon={Receipt}
        ctaLabel="Выписать счёт"
        ctaHint="После создания заказа вы получите счёт по email. Заказ начнёт движение после поступления оплаты."
        loading={submitting}
        disabled={!isLegalReady}
        error={error}
        unknownPaymentWarning={
          unknownCount > 0 ? "Часть позиций без цены — точная сумма будет в счёте." : undefined
        }
        consent={consent}
        onConsentChange={setConsent}
      />
    </form>
  );
}
