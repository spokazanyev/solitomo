import { getPayload } from "payload";

/**
 * Seed script for «Сертификаты Солитон» — 2 документа:
 *   1. Сертификат соответствия ЕАЭС KG417/039.RU.02.05188 (ТР ТС 004/2011 + 020/2011)
 *   2. Декларация о соответствии ЕАЭС N RU Д-RU.PA06.B.59175/25 (ТР ЕАЭС 037/2016 / RoHS)
 *
 * Оба покрывают сетевые розетки модульного типа S, SP, SPF, Amp, S-УЗО,
 * S-IEC320C13, S-IEC320C19, S-XC13+XC19, S-XC13+XC19 M&C — это вся линейка
 * S-* в нашем каталоге. Файлы лежат в apps/web/public/documents/certificates/.
 *
 * Запуск:
 *   pnpm seed:soliton-certs
 *
 * Idempotent: документ ищется по title; если найден — обновляются поля
 * externalUrl/documentType/etc, привязка к продуктам пересобирается.
 *
 * На странице /documents/certificates/ документы попадают через
 * `getDocumentRegistry()` (apps/web/src/components/page-templates.tsx) —
 * он собирает product.documents для опубликованных товаров.
 */

const CERTIFICATES = [
  {
    title:
      "Сертификат соответствия ЕАЭС KG417/039.RU.02.05188 — сетевые розетки",
    documentType: "certificate",
    externalUrl:
      "/documents/certificates/sertifikat-sootvetstviya-EAEC-KG417-039-RU-02-05188.jpg",
    versionLabel: "31.07.2025 — 30.07.2030",
    proofRole:
      "Соответствие ТР ТС 004/2011 «О безопасности низковольтного оборудования» и ТР ТС 020/2011 «Электромагнитная совместимость технических средств». Серийный выпуск, выдан 28.07.2025 ООО «Промышленная Безопасность».",
    downloadCtaLabel: "Скачать сертификат",
  },
  {
    title:
      "Декларация о соответствии ЕАЭС N RU Д-RU.PA06.B.59175/25 — сетевые розетки",
    documentType: "declaration",
    externalUrl:
      "/documents/certificates/deklaraciya-sootvetstviya-EAEC-RU-D-RU-PA06-B-59175-25.jpg",
    versionLabel: "31.07.2025 — 30.07.2030",
    proofRole:
      "Соответствие ТР ЕАЭС 037/2016 «Об ограничении применения опасных веществ в изделиях электротехники и радиоэлектроники» (RoHS). Зарегистрирована 31.07.2025.",
    downloadCtaLabel: "Скачать декларацию",
  },
];

export async function script(config) {
  const payload = await getPayload({ config });
  payload.logger.info("Seeding soliton certificates");

  // Все опубликованные товары — сертификаты охватывают всю линейку S-*.
  const productsResult = await payload.find({
    collection: "products",
    where: { status: { equals: "published" } },
    depth: 0,
    limit: 500,
    pagination: false,
  });
  const productIds = productsResult.docs.map((p) => p.id);
  payload.logger.info(
    `Found ${productIds.length} published products — attaching certs to all`,
  );

  for (const cert of CERTIFICATES) {
    const existing = await payload.find({
      collection: "documents",
      where: { title: { equals: cert.title } },
      depth: 0,
      limit: 1,
    });

    const fields = {
      title: cert.title,
      status: "published",
      documentType: cert.documentType,
      externalUrl: cert.externalUrl,
      versionLabel: cert.versionLabel,
      proofRole: cert.proofRole,
      downloadCtaLabel: cert.downloadCtaLabel,
      products: productIds,
    };

    if (existing.docs.length > 0) {
      const id = existing.docs[0].id;
      await payload.update({ collection: "documents", id, data: fields });
      payload.logger.info(`UPDATED: ${cert.title} (id=${id})`);
    } else {
      const created = await payload.create({ collection: "documents", data: fields });
      payload.logger.info(`CREATED: ${cert.title} (id=${created.id})`);
    }
  }

  payload.logger.info("Seed complete");
}
