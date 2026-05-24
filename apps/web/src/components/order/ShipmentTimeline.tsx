interface Event {
  eventId?: string;
  internalStatus?: string;
  providerStatus?: string;
  at?: string;
  message?: string;
}

const STATUS_LABEL: Record<string, string> = {
  created: "Заказ создан",
  pending_label: "Этикетка готовится",
  in_transit: "Передан перевозчику",
  at_point: "Прибыл в пункт выдачи",
  delivered: "Вручён",
  returned: "Возврат отправителю",
  cancelled: "Отменён",
  error: "Ошибка",
};

export function ShipmentTimeline({
  events = [],
  trackingNumber,
  trackingUrl,
}: {
  events?: Event[];
  trackingNumber?: string;
  trackingUrl?: string;
}) {
  if (events.length === 0 && !trackingNumber) return null;
  const sorted = [...events].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">Доставка</h3>
      {trackingNumber && (
        <p className="mt-1 text-sm">
          Трек: <span className="font-mono">{trackingNumber}</span>
          {trackingUrl && (
            <>
              {" — "}
              <a className="text-sky-700 hover:underline" href={trackingUrl} target="_blank" rel="noreferrer">
                Отследить у перевозчика
              </a>
            </>
          )}
        </p>
      )}
      {sorted.length > 0 && (
        <ol className="mt-4 space-y-2">
          {sorted.map((e, i) => (
            <li key={e.eventId ?? i} className="flex gap-3 text-sm">
              <span className="text-slate-500">
                {e.at ? new Date(e.at).toLocaleString("ru-RU") : ""}
              </span>
              <span>
                {STATUS_LABEL[e.internalStatus ?? ""] ?? e.providerStatus ?? "Событие"}
                {e.message ? ` — ${e.message}` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
