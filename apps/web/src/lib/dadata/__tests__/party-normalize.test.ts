/**
 * Unit-тесты для partyToRequisites — data-model.md §2 / R5.
 *
 * Покрывают маппинг 5 полей реквизитов + status + isRisky:
 * полное юрлицо, ИП без КПП, отсутствующий адрес/ОГРН, рисковые статусы,
 * fallback наименования.
 */
import { describe, expect, it } from "vitest";

import type { DadataPartyData } from "../client";
import { partyToRequisites } from "../party-normalize";

describe("partyToRequisites", () => {
  it("полное юрлицо (LEGAL) — все 5 полей замаплены, status ACTIVE, isRisky false", () => {
    const data: DadataPartyData = {
      inn: "7707083893",
      kpp: "770701001",
      ogrn: "1027700132195",
      type: "LEGAL",
      branch_type: "MAIN",
      name: {
        full_with_opf: 'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "СБЕРБАНК РОССИИ"',
        short_with_opf: "ПАО СБЕРБАНК",
      },
      address: {
        value: "г Москва, ул Вавилова, д 19",
        unrestricted_value: "117997, г Москва, ул Вавилова, д 19",
      },
      state: { status: "ACTIVE" },
    };

    const result = partyToRequisites(data);
    expect(result.companyName).toBe("ПАО СБЕРБАНК");
    expect(result.inn).toBe("7707083893");
    expect(result.kpp).toBe("770701001");
    expect(result.ogrn).toBe("1027700132195");
    expect(result.legalAddress).toBe("117997, г Москва, ул Вавилова, д 19");
    expect(result.status).toBe("ACTIVE");
    expect(result.isRisky).toBe(false);
  });

  it("ИП (INDIVIDUAL) без КПП — kpp пустой, остальные поля корректны", () => {
    const data: DadataPartyData = {
      inn: "500100732259",
      ogrn: "304500116000157",
      type: "INDIVIDUAL",
      branch_type: "MAIN",
      name: { short_with_opf: "ИП Иванов Иван Иванович" },
      address: { unrestricted_value: "Московская обл, г Балашиха" },
      state: { status: "ACTIVE" },
    };

    const result = partyToRequisites(data);
    expect(result.kpp).toBe("");
    expect(result.inn).toBe("500100732259");
    expect(result.companyName).toBe("ИП Иванов Иван Иванович");
    expect(result.legalAddress).toBe("Московская обл, г Балашиха");
    expect(result.isRisky).toBe(false);
  });

  it("отсутствующие адрес и ОГРН → legalAddress и ogrn пустые", () => {
    const data: DadataPartyData = {
      inn: "7707083893",
      kpp: "770701001",
      type: "LEGAL",
      name: { short_with_opf: "ООО Ромашка" },
      state: { status: "ACTIVE" },
    };

    const result = partyToRequisites(data);
    expect(result.ogrn).toBe("");
    expect(result.legalAddress).toBe("");
  });

  it("рисковые статусы (LIQUIDATING/LIQUIDATED/BANKRUPT) → isRisky true", () => {
    for (const status of ["LIQUIDATING", "LIQUIDATED", "BANKRUPT"] as const) {
      const data: DadataPartyData = {
        inn: "7707083893",
        name: { short_with_opf: "ООО Тест" },
        state: { status },
      };
      const result = partyToRequisites(data);
      expect(result.status).toBe(status);
      expect(result.isRisky).toBe(true);
    }
  });

  it("безопасные статусы (ACTIVE/REORGANIZING) → isRisky false", () => {
    for (const status of ["ACTIVE", "REORGANIZING"] as const) {
      const data: DadataPartyData = {
        inn: "7707083893",
        name: { short_with_opf: "ООО Тест" },
        state: { status },
      };
      const result = partyToRequisites(data);
      expect(result.status).toBe(status);
      expect(result.isRisky).toBe(false);
    }
  });

  it("fallback наименования: только full_with_opf → companyName использует его", () => {
    const data: DadataPartyData = {
      inn: "7707083893",
      name: { full_with_opf: 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "РОМАШКА"' },
      state: { status: "ACTIVE" },
    };

    const result = partyToRequisites(data);
    expect(result.companyName).toBe('ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "РОМАШКА"');
  });

  it("status отсутствует → status null, isRisky false", () => {
    const data: DadataPartyData = {
      inn: "7707083893",
      name: { short_with_opf: "ООО Тест" },
    };
    const result = partyToRequisites(data);
    expect(result.status).toBeNull();
    expect(result.isRisky).toBe(false);
  });
});
