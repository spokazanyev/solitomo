"use client";

/**
 * 060: индикатор заполненности физических параметров товара в admin-list view
 * коллекции `products`. Все 4 поля заполнены → ✓ (зелёный),
 * хоть одно пустое → ⚠ (янтарный) с tooltip-объяснением.
 *
 * Цель: быстрая визуальная диагностика «у каких товаров не заполнено» —
 * чтобы контент-менеджер видел пробелы прямо в списке без захода в карточку.
 */

import React from "react";

type PhysicalPackaging = {
  weightGrams?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
} | null;

interface Props {
  cellData?: PhysicalPackaging;
}

export default function PhysicalPackagingStatus({ cellData }: Props): React.ReactElement {
  const filled = Boolean(
    cellData &&
      typeof cellData.weightGrams === "number" &&
      typeof cellData.lengthMm === "number" &&
      typeof cellData.widthMm === "number" &&
      typeof cellData.heightMm === "number",
  );

  if (filled) {
    const w = cellData!.weightGrams!;
    const l = cellData!.lengthMm!;
    const wd = cellData!.widthMm!;
    const h = cellData!.heightMm!;
    return (
      <span
        title={`Габариты упаковки: ${w} г, ${l}×${wd}×${h} мм`}
        style={{ color: "#16a34a", fontWeight: 600 }}
      >
        ✓
      </span>
    );
  }

  return (
    <span
      title="Физические параметры не заполнены — расчёт доставки использует дефолтные значения из настроек ApiShip"
      style={{ color: "#d97706", fontWeight: 600 }}
    >
      ⚠
    </span>
  );
}
