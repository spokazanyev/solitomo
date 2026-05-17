"use client";

import { CheckCircle2, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  clearRfqCartItems,
  mergeRfqItems,
  readRfqCartItems,
  writeRfqCartItems,
  type RfqCartItem,
} from "@/components/rfq/RfqCart";
import { trackAnalyticsEvent } from "@/lib/analytics/events";

type RfqItem = RfqCartItem;

type SubmitState =
  | {
      message: string;
      requestId?: string;
      status: "idle" | "submitting" | "success" | "error";
    };

const emptyItem: RfqItem = {
  name: "",
  quantity: "1",
  sku: "",
};

function fieldClass() {
  return "min-w-0 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-100";
}

function countItems(items: RfqItem[]) {
  return items
    .filter((item) => item.sku || item.name)
    .reduce((sum, item) => {
      const quantity = Number.parseInt(item.quantity, 10);
      return sum + (Number.isFinite(quantity) ? quantity : 1);
    }, 0);
}

function rfqItemKey(item: RfqItem) {
  return (item.sku || item.name).trim().toLocaleLowerCase("ru-RU");
}

function mergeQueryItemWithCart(queryItem: RfqItem, cartItems: RfqItem[]) {
  if (!queryItem.sku && !queryItem.name) {
    return mergeRfqItems(cartItems);
  }

  const queryKey = rfqItemKey(queryItem);
  const cartHasSameItem = cartItems.some((item) => rfqItemKey(item) === queryKey);

  return cartHasSameItem ? mergeRfqItems(cartItems) : mergeRfqItems([queryItem, ...cartItems]);
}

export function RfqForm() {
  const searchParams = useSearchParams();
  const querySku = searchParams.get("sku") ?? "";
  const queryProduct = searchParams.get("product") ?? "";
  const initialItem = useMemo<RfqItem>(() => {
    return querySku || queryProduct
      ? { sku: querySku, name: queryProduct, quantity: "1" }
      : { ...emptyItem };
  }, [queryProduct, querySku]);

  const [items, setItems] = useState<RfqItem[]>([initialItem]);
  const [state, setState] = useState<SubmitState>({
    message: "",
    status: "idle",
  });
  const rfqOpenTracked = useRef(false);
  const shouldPersistItems = useRef(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextItems = mergeQueryItemWithCart(initialItem, readRfqCartItems());
      const formItems = nextItems.length ? nextItems : [initialItem];

      if (nextItems.length) {
        shouldPersistItems.current = true;
        setItems(nextItems);
      }

      if (!rfqOpenTracked.current) {
        rfqOpenTracked.current = true;
        trackAnalyticsEvent("begin_checkout", {
          form_type: "rfq",
          items_count: countItems(formItems),
          source_page: window.location.pathname + window.location.search,
        });
        trackAnalyticsEvent("rfq_open", {
          form_type: "rfq",
          items_count: countItems(formItems),
          source_page: window.location.pathname + window.location.search,
        });
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [initialItem]);

  useEffect(() => {
    if (!shouldPersistItems.current) {
      return;
    }

    writeRfqCartItems(items);
  }, [items]);

  function updateItem(index: number, field: keyof RfqItem, value: string) {
    shouldPersistItems.current = true;
    setItems((current) => {
      return current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      );
    });
  }

  function addItem() {
    shouldPersistItems.current = true;
    setItems((current) => {
      return [...current, { ...emptyItem }];
    });
  }

  function removeItem(index: number) {
    shouldPersistItems.current = true;
    setItems((current) => {
      return current.length === 1
        ? [{ ...emptyItem }]
        : current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();

    if (!email && !phone) {
      setState({
        message: "Укажите email или телефон, чтобы менеджер мог отправить КП.",
        status: "error",
      });
      return;
    }

    setState({ message: "", status: "submitting" });

    const response = await fetch("/api/rfq-submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerType: formData.get("customerType"),
        companyName: formData.get("companyName"),
        inn: formData.get("inn"),
        contactName: formData.get("contactName"),
        email,
        phone,
        city: formData.get("city"),
        deadline: formData.get("deadline"),
        message: formData.get("message"),
        technicalSpec: formData.get("technicalSpec"),
        sourcePage: window.location.pathname + window.location.search,
        items,
      }),
    });

    const result = (await response.json()) as {
      error?: string;
      id?: string;
      ok?: boolean;
    };

    if (!response.ok || !result.ok) {
      setState({
        message: result.error ?? "Не удалось отправить заявку.",
        status: "error",
      });
      return;
    }

    setState({
      message: "Заявка сохранена. Менеджер сможет подготовить КП по указанным данным.",
      requestId: result.id,
      status: "success",
    });
    trackAnalyticsEvent("rfq_submit", {
      company_provided: Boolean(formData.get("companyName")),
      form_type: "rfq",
      inn_provided: Boolean(formData.get("inn")),
      items_count: countItems(items),
      request_id: result.id,
      source_page: window.location.pathname + window.location.search,
    });
    clearRfqCartItems();
    shouldPersistItems.current = false;
    setItems([{ ...emptyItem }]);
  }

  return (
    <form className="grid min-w-0 gap-8" onSubmit={handleSubmit}>
      <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sky-800">Позиции для КП</p>
            <h2 className="mt-1 text-lg font-semibold leading-tight break-words text-slate-950 sm:text-xl">
              PDU, сетевые фильтры или параметры подбора
            </h2>
          </div>
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-sky-700 hover:text-sky-800 sm:w-auto"
            onClick={addItem}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Добавить
          </button>
        </div>
        <div className="mt-5 grid min-w-0 gap-3">
          {items.map((item, index) => (
            <div
              className="grid min-w-0 gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-[minmax(120px,160px)_minmax(0,1fr)_90px_auto]"
              key={index}
            >
              <input
                className={fieldClass()}
                onChange={(event) => updateItem(index, "sku", event.target.value)}
                placeholder="SKU"
                value={item.sku}
              />
              <input
                className={fieldClass()}
                onChange={(event) => updateItem(index, "name", event.target.value)}
                placeholder="Название, фильтр, PDU или описание позиции"
                value={item.name}
              />
              <input
                className={fieldClass()}
                min="1"
                onChange={(event) => updateItem(index, "quantity", event.target.value)}
                placeholder="Кол-во"
                type="number"
                value={item.quantity}
              />
              <button
                aria-label="Удалить позицию"
                className="inline-flex h-10 w-10 items-center justify-center justify-self-start rounded-md border border-slate-300 text-slate-500 hover:border-red-300 hover:text-red-700 md:justify-self-auto"
                onClick={() => removeItem(index)}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="grid min-w-0 gap-5 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-sky-800">Контактные данные</p>
          <h2 className="mt-1 text-lg font-semibold leading-tight break-words text-slate-950 sm:text-xl">
            Куда отправить КП
          </h2>
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
            Тип клиента
            <select className={fieldClass()} defaultValue="company" name="customerType">
              <option value="company">Юрлицо</option>
              <option value="integrator">Интегратор</option>
              <option value="person">Физлицо</option>
            </select>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
            Компания
            <input className={fieldClass()} name="companyName" placeholder="ООО, ИП или организация" />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
            ИНН
            <input className={fieldClass()} name="inn" placeholder="Для счета и проверки реквизитов" />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
            Контактное лицо *
            <input className={fieldClass()} name="contactName" placeholder="Имя" required />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
            Email
            <input className={fieldClass()} name="email" placeholder="name@company.ru" type="email" />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
            Телефон
            <input className={fieldClass()} name="phone" placeholder="+7..." />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
            Город поставки
            <input className={fieldClass()} name="city" placeholder="Например, Екатеринбург" />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
            Желаемый срок
            <input className={fieldClass()} name="deadline" placeholder="Дата или период" />
          </label>
        </div>
        <p className="text-sm leading-6 text-slate-500">
          Для отправки достаточно одного канала связи: email или телефон. Для
          счета и документов укажите компанию и ИНН, если они уже известны.
        </p>
      </section>

      <section className="grid min-w-0 gap-4 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
          Комментарий к заявке
          <textarea
            className={fieldClass()}
            name="message"
            placeholder="Что нужно подобрать: сетевой фильтр, PDU, блок розеток, условия поставки, документы, аналоги, требования проекта"
            rows={4}
          />
        </label>
        <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
          ТЗ или список оборудования
          <textarea
            className={fieldClass()}
            name="technicalSpec"
            placeholder="Можно вставить текст ТЗ, список оборудования стойки, параметры нагрузки или требования к защите/УЗИП"
            rows={5}
          />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
          disabled={state.status === "submitting"}
          type="submit"
        >
          {state.status === "submitting" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Отправить заявку
        </button>
        {state.status === "success" ? (
          <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {state.message} Номер: {state.requestId}
          </p>
        ) : null}
        {state.status === "error" ? (
          <p aria-live="polite" className="text-sm font-medium text-red-700">{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
