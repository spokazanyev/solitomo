"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type ProductImageZoomProps = {
  alt: string;
  buttonClassName: string;
  image?: string;
  imageClassName: string;
  images?: string[];
  initialIndex?: number;
};

function ProductImageLightbox({
  alt,
  images,
  initialIndex,
  onClose,
}: {
  alt: string;
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const hasSeveralImages = images.length > 1;
  const image = images[activeIndex] ?? images[0] ?? "/placeholders/pdu-silhouette.svg";

  const showNextImage = useCallback(() => {
    setActiveIndex((index) => (index + 1) % images.length);
  }, [images.length]);

  const showPreviousImage = useCallback(() => {
    setActiveIndex((index) => (index - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (!hasSeveralImages) {
        return;
      }

      if (event.key === "ArrowRight") {
        showNextImage();
      }

      if (event.key === "ArrowLeft") {
        showPreviousImage();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [hasSeveralImages, images.length, onClose, showNextImage, showPreviousImage]);

  return (
    <div
      aria-label="Увеличенное изображение товара"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4"
      role="dialog"
    >
      <button
        aria-label="Закрыть увеличенное изображение"
        className="absolute inset-0 cursor-zoom-out"
        onClick={onClose}
        type="button"
      />
      <div className="relative z-10 grid max-h-[92vh] w-full max-w-5xl gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{alt}</p>
            {hasSeveralImages ? (
              <p className="mt-0.5 text-xs text-slate-500">
                Фото {activeIndex + 1} из {images.length}
              </p>
            ) : null}
          </div>
          <button
            aria-label="Закрыть"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:border-sky-500 hover:text-sky-800"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative rounded-md bg-slate-50">
          {/* Cached legacy assets from soliton1.ru, served from /public/legacy/. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={alt}
            className="max-h-[70vh] w-full rounded-md object-contain"
            decoding="async"
            src={image}
          />
          {hasSeveralImages ? (
            <>
              <button
                aria-label="Предыдущее фото"
                className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:border-sky-500 hover:text-sky-800"
                onClick={showPreviousImage}
                type="button"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                aria-label="Следующее фото"
                className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:border-sky-500 hover:text-sky-800"
                onClick={showNextImage}
                type="button"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
        </div>
        {hasSeveralImages ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((thumbnail, index) => (
              <button
                aria-label={`Показать фото ${index + 1}`}
                className={`h-16 w-16 shrink-0 rounded-md border bg-slate-50 p-1 transition ${
                  index === activeIndex
                    ? "border-sky-600 ring-2 ring-sky-100"
                    : "border-slate-200 hover:border-sky-400"
                }`}
                key={`${thumbnail}-${index}`}
                onClick={() => setActiveIndex(index)}
                type="button"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`${alt}, фото ${index + 1}`}
                  className="h-full w-full object-contain"
                  decoding="async"
                  src={thumbnail}
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ProductImageZoom({
  alt,
  buttonClassName,
  image,
  imageClassName,
  images,
  initialIndex = 0,
}: ProductImageZoomProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const galleryImages =
    images && images.length > 0
      ? images
      : [image || "/placeholders/pdu-silhouette.svg"];
  const safeInitialIndex =
    initialIndex >= 0 && initialIndex < galleryImages.length ? initialIndex : 0;
  const previewImage = galleryImages[safeInitialIndex] ?? galleryImages[0];

  return (
    <>
      <button
        aria-label={`Увеличить изображение: ${alt}`}
        className={buttonClassName}
        onClick={() => setLightboxOpen(true)}
        type="button"
      >
        {/* Cached legacy assets from soliton1.ru, served from /public/legacy/. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={alt}
          className={imageClassName}
          decoding="async"
          loading="lazy"
          src={previewImage}
        />
      </button>
      {lightboxOpen ? (
        <ProductImageLightbox
          alt={alt}
          images={galleryImages}
          initialIndex={safeInitialIndex}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </>
  );
}
