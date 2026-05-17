import Link from "next/link";

const guideItems = [
  {
    href: "/admin/collections/products/",
    label: "Товары",
    text: "названия, характеристики, фото, документы, SEO и schema.org Product",
  },
  {
    href: "/admin/collections/filter-fields/",
    label: "Фильтры",
    text: "поля, опции, счетчики, категории и правила индексируемости",
  },
  {
    href: "/admin/collections/rfq-requests/",
    label: "Заявки КП",
    text: "позиции, контакты, статус обработки, ответственный и следующий шаг",
  },
  {
    href: "/admin/collections/admin-change-log/",
    label: "Журнал",
    text: "фиксация агентских, ручных и импортных изменений",
  },
];

export function AdminProjectGuide() {
  return (
    <section
      style={{
        border: "1px solid var(--theme-elevation-150)",
        borderRadius: 6,
        marginBlockEnd: 24,
        padding: 20,
      }}
    >
      <p
        style={{
          color: "var(--theme-elevation-600)",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.08em",
          margin: 0,
          textTransform: "uppercase",
        }}
      >
        Soliton admin
      </p>
      <h2 style={{ fontSize: 24, margin: "8px 0 0" }}>
        Рабочая панель каталога, SEO и заявок
      </h2>
      <p style={{ color: "var(--theme-elevation-700)", margin: "10px 0 0", maxWidth: 920 }}>
        Текущий приоритет проекта: современная SEO-витрина Soliton с каталогом
        PDU, фильтрами, карточками товаров и надежным приемом заявок на КП.
        МойСклад, онлайн-оплата и доставка пока отложены и не должны блокировать
        работу с контентом.
      </p>
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginTop: 18,
        }}
      >
        {guideItems.map((item) => (
          <Link
            href={item.href}
            key={item.href}
            style={{
              border: "1px solid var(--theme-elevation-150)",
              borderRadius: 6,
              color: "inherit",
              padding: 14,
              textDecoration: "none",
            }}
          >
            <strong>{item.label}</strong>
            <span
              style={{
                color: "var(--theme-elevation-600)",
                display: "block",
                fontSize: 13,
                lineHeight: 1.5,
                marginTop: 6,
              }}
            >
              {item.text}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
