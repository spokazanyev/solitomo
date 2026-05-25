"use client";

import { Loader2, Star } from "lucide-react";
import { useState } from "react";

interface Props {
  token: string;
}

export function ReviewForm({ token }: Props) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [likedMost, setLikedMost] = useState("");
  const [improvements, setImprovements] = useState("");
  const [publish, setPublish] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || done) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(token)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, likedMost, improvements, publish }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
        if (body.code === "ALREADY_SUBMITTED") {
          setDone(true);
          return;
        }
        throw new Error(body.message || "Не удалось отправить отзыв");
      }
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
        <h2 className="text-lg font-semibold">Спасибо за отзыв!</h2>
        <p className="mt-2 text-sm leading-6">
          Мы получили ваш отзыв и обязательно учтём его при работе над сервисом.
        </p>
      </section>
    );
  }

  const displayRating = hoverRating ?? rating;

  return (
    <form className="grid gap-6" onSubmit={handleSubmit}>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Как вам всё прошло?
        </p>
        <div className="mt-4 flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              type="button"
              key={star}
              aria-label={`Оценка ${star}`}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(null)}
              className="text-amber-500 transition-transform hover:scale-110 focus:outline-none"
            >
              <Star
                className="h-8 w-8"
                fill={star <= displayRating ? "currentColor" : "none"}
                strokeWidth={1.5}
              />
            </button>
          ))}
          <span className="ml-2 text-sm text-slate-600">{displayRating} из 5</span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Что особенно понравилось?
          <textarea
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
            rows={3}
            value={likedMost}
            onChange={(e) => setLikedMost(e.target.value)}
            maxLength={2000}
          />
        </label>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Что можно улучшить?
          <textarea
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
            rows={3}
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
            maxLength={2000}
          />
        </label>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
          />
          <span>Согласен опубликовать отзыв на сайте.</span>
        </label>

        {error ? (
          <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900">{error}</p>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? "Отправляем…" : "Отправить отзыв"}
          </button>
        </div>
      </section>
    </form>
  );
}
