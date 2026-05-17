import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetailPage } from "@/components/product/ProductDetailPage";
import { getProductBySlug, getProducts } from "@/lib/products/source-products";

type ProductPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return getProducts().map((product) => ({
    slug: product.slug,
  }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return {};
  }

  return {
    title: product.h1,
    description: product.shortDescription,
    alternates: {
      canonical: `/product/${product.slug}/`,
    },
    openGraph: {
      title: product.h1,
      description: product.shortDescription,
      images: product.images.slice(0, 1),
      type: "website",
      url: `/product/${product.slug}/`,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return <ProductDetailPage product={product} />;
}
