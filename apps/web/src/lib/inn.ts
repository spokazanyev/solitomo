const INN10_WEIGHTS = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const INN12_WEIGHTS_11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const INN12_WEIGHTS_12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

function controlDigit(digits: number[], weights: number[]) {
  let sum = 0;
  for (let i = 0; i < weights.length; i += 1) {
    sum += digits[i] * weights[i];
  }
  return (sum % 11) % 10;
}

export function isValidInn(value: string): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  const digits = [...trimmed].map((d) => Number.parseInt(d, 10));
  if (digits.length === 10) {
    return controlDigit(digits, INN10_WEIGHTS) === digits[9];
  }
  if (digits.length === 12) {
    return (
      controlDigit(digits, INN12_WEIGHTS_11) === digits[10] &&
      controlDigit(digits, INN12_WEIGHTS_12) === digits[11]
    );
  }
  return false;
}
