# Contract: Static Pages API & Helpers

**Назначение:** API доступа к содержимому buyer-info страниц через Payload Local API.

## Helper: getStaticPage(slug)

```typescript
// apps/web/src/lib/static-pages/get-static-page.ts
import "server-only";
import { getPayload } from "payload";
import configPromise from "@payload-config";

export interface StaticPageDoc {
  id: string | number;
  slug: string;
  section: "info" | "company" | "other";
  title: string;
  subtitle?: string;
  body: unknown; // Lexical rich-text JSON
  category: "policy" | "info" | "faq";
  version?: string;
  effectiveFrom?: string;
  seoTitle?: string;
  seoDescription?: string;
  indexingPolicy: "index" | "noindex";
  status: "draft" | "published";
  updatedAt: string;
  createdAt: string;
}

const cache: Map<string, { doc: StaticPageDoc; cachedAt: number }> = new Map();
const CACHE_TTL_MS = 60_000;

export async function getStaticPage(slug: string): Promise<StaticPageDoc | null> {
  const cached = cache.get(slug);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.doc;
  }
  const payload = await getPayload({ config: configPromise });
  const result = await payload.find({
    collection: "static-pages" as never,
    where: { and: [{ slug: { equals: slug } }, { status: { equals: "published" } }] },
    limit: 1,
    depth: 0,
  });
  const doc = (result.docs[0] as unknown as StaticPageDoc | undefined) ?? null;
  if (doc) cache.set(slug, { doc, cachedAt: Date.now() });
  return doc;
}

export function invalidateStaticPageCache(slug?: string): void {
  if (slug) cache.delete(slug);
  else cache.clear();
}
```

## Page contract: `app/(site)/info/[slug]/page.tsx`

```typescript
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getStaticPage } from "@/lib/static-pages/get-static-page";
import { StaticPageRenderer } from "@/components/static-pages/StaticPageRenderer";
import { getSeoRoute, createMetadata, pathFromSegments } from "@/lib/seo/seo-registry";

const ALLOWED_SLUGS = ["payment", "delivery", "return", "warranty", "offer", "privacy", "pd-policy", "terms", "faq"] as const;
type AllowedSlug = (typeof ALLOWED_SLUGS)[number];

export function generateStaticParams() {
  return ALLOWED_SLUGS.map((slug) => ({ slug }));
}

export const dynamic = "force-static";
export const revalidate = 300; // 5 min ISR

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!ALLOWED_SLUGS.includes(slug as AllowedSlug)) return {};
  const route = getSeoRoute(`/info/${slug}/`);
  if (!route) return {};
  return createMetadata(route);
}

export default async function InfoPage({ params }: Props) {
  const { slug } = await params;
  if (!ALLOWED_SLUGS.includes(slug as AllowedSlug)) notFound();
  const page = await getStaticPage(slug);
  if (!page) notFound();
  return <StaticPageRenderer page={page} />;
}
```

## Component: `StaticPageRenderer`

```typescript
// apps/web/src/components/static-pages/StaticPageRenderer.tsx
import type { StaticPageDoc } from "@/lib/static-pages/get-static-page";
import { LexicalRenderer } from "@/components/static-pages/LexicalRenderer";
import { BuyerInfoNav } from "@/components/layout/BuyerInfoNav";

type Props = { page: StaticPageDoc };

export function StaticPageRenderer({ page }: Props) {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-10 md:px-10 lg:grid-cols-[260px_1fr] lg:px-12">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <BuyerInfoNav currentSlug={page.slug} />
      </aside>
      <article className="prose prose-slate max-w-none">
        <nav aria-label="breadcrumb" className="not-prose mb-6 text-sm text-slate-500">
          <a href="/">Главная</a> / <a href="/info/payment/">Покупателям</a> / <span>{page.title}</span>
        </nav>
        <h1>{page.title}</h1>
        {page.subtitle && <p className="lead">{page.subtitle}</p>}
        {page.category === "policy" && page.version && page.effectiveFrom && (
          <p className="not-prose text-sm text-slate-500">
            Версия {page.version} · Действует с {new Date(page.effectiveFrom).toLocaleDateString("ru-RU")}
          </p>
        )}
        <LexicalRenderer body={page.body} />
      </article>
    </div>
  );
}
```

## Seed-скрипт contract

```typescript
// apps/web/scripts/seed-static-pages.mjs (исполняется через payload bin)
import { getPayload } from "payload";
import configPromise from "../src/payload.config.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, "../../../specs/057-yookassa-buyer-info-compliance/contracts/content-templates");

const PAGES = [
  { slug: "payment", section: "info", category: "info", title: "Способы оплаты", template: "payment.md" },
  { slug: "delivery", section: "info", category: "info", title: "Доставка", template: "delivery.md" },
  { slug: "return", section: "info", category: "info", title: "Возврат товара", template: "return.md" },
  { slug: "warranty", section: "info", category: "info", title: "Гарантийное обслуживание", template: "warranty.md" },
  { slug: "offer", section: "info", category: "policy", title: "Публичная оферта", template: "offer.md", version: "2026-05-25-v1" },
  { slug: "privacy", section: "info", category: "policy", title: "Политика конфиденциальности", template: "privacy.md", version: "2026-05-25-v1" },
  { slug: "pd-policy", section: "info", category: "policy", title: "Политика обработки персональных данных", template: "pd-policy.md", version: "2026-05-25-v1" },
  { slug: "terms", section: "info", category: "policy", title: "Пользовательское соглашение", template: "terms.md", version: "2026-05-25-v1" },
  { slug: "faq", section: "info", category: "faq", title: "Вопросы и ответы", template: "faq.md" },
];

const payload = await getPayload({ config: configPromise });
for (const p of PAGES) {
  const existing = await payload.find({ collection: "static-pages", where: { slug: { equals: p.slug } }, limit: 1 });
  if (existing.docs.length > 0) {
    console.log(`[seed] ${p.slug} already exists, skipping`);
    continue;
  }
  const markdown = readFileSync(path.join(TEMPLATES_DIR, p.template), "utf8");
  // markdown → lexical conversion (simple paragraph splitter for MVP)
  const lexicalBody = markdownToLexicalSimple(markdown);
  await payload.create({
    collection: "static-pages",
    data: {
      slug: p.slug,
      section: p.section,
      category: p.category,
      title: p.title,
      body: lexicalBody,
      version: p.version,
      effectiveFrom: p.version ? "2026-05-25" : undefined,
      indexingPolicy: "index",
      status: "published",
    },
  });
  console.log(`[seed] created ${p.slug}`);
}
process.exit(0);
```

## Cache invalidation hook

```typescript
// в StaticPages.ts
hooks: {
  afterChange: [
    ({ doc }) => {
      // invalidate page cache
      try {
        const mod = await import("../lib/static-pages/get-static-page");
        mod.invalidateStaticPageCache(doc.slug);
      } catch {}
      // invalidate policy version cache if это политика
      if (doc.category === "policy") {
        try {
          const mod = await import("../lib/consent/make-consent-record");
          mod.invalidatePolicyVersionCache();
        } catch {}
      }
    },
  ],
}
```
