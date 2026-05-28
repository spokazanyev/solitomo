/**
 * Локальная проверка контрольной суммы ИНН (FR-007/FR-008).
 *
 * Чистая функция без сети и без зависимостей — пригодна для использования
 * из клиентского компонента (`InvoiceCheckoutForm`). Алгоритм канонический (ФНС):
 * см. `specs/063-dadata-party-autofill/contracts/inn-validation.md`.
 */

const WEIGHTS_10 = [2, 4, 10, 3, 5, 9, 4, 6, 8] as const;
const WEIGHTS_11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8] as const;
const WEIGHTS_12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8] as const;

function controlDigit(digits: number[], weights: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i += 1) {
    sum += weights[i]! * digits[i]!;
  }
  return (sum % 11) % 10;
}

/** true только для математически корректного ИНН длиной 10 или 12 цифр. */
export function isValidInn(inn: string): boolean {
  const value = inn.trim();
  if (!/^[0-9]{10}$/.test(value) && !/^[0-9]{12}$/.test(value)) {
    return false;
  }

  const digits = value.split("").map((char) => Number(char));

  if (digits.length === 10) {
    return controlDigit(digits, WEIGHTS_10) === digits[9];
  }

  const n11 = controlDigit(digits, WEIGHTS_11);
  const n12 = controlDigit(digits, WEIGHTS_12);
  return n11 === digits[10] && n12 === digits[11];
}
