/**
 * Сумма прописью (рубли + копейки) для PDF-счетов.
 *
 * Пример: amountInWords(7856.8) →
 *   "Семь тысяч восемьсот пятьдесят шесть рублей 80 копеек"
 *
 * Учитывает русскую грамматику: род (одна тысяча / два рубля), склонение
 * (рубль/рубля/рублей, копейка/копейки/копеек), разряды (тысячи — женский род).
 */

const ONES = [
  "",
  "один",
  "два",
  "три",
  "четыре",
  "пять",
  "шесть",
  "семь",
  "восемь",
  "девять",
];
const ONES_FEM = [
  "",
  "одна",
  "две",
  "три",
  "четыре",
  "пять",
  "шесть",
  "семь",
  "восемь",
  "девять",
];
const TEENS = [
  "десять",
  "одиннадцать",
  "двенадцать",
  "тринадцать",
  "четырнадцать",
  "пятнадцать",
  "шестнадцать",
  "семнадцать",
  "восемнадцать",
  "девятнадцать",
];
const TENS = [
  "",
  "",
  "двадцать",
  "тридцать",
  "сорок",
  "пятьдесят",
  "шестьдесят",
  "семьдесят",
  "восемьдесят",
  "девяносто",
];
const HUNDREDS = [
  "",
  "сто",
  "двести",
  "триста",
  "четыреста",
  "пятьсот",
  "шестьсот",
  "семьсот",
  "восемьсот",
  "девятьсот",
];

/** Склонение слова по числу: [1, 2-4, 5-0]. Например ["рубль","рубля","рублей"]. */
function plural(n: number, forms: [string, string, string]): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/** Преобразует трёхзначную группу (0..999) в слова. `fem` — женский род для единиц. */
function tripletToWords(n: number, fem: boolean): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;

  if (h > 0) parts.push(HUNDREDS[h]);
  if (t > 1) {
    parts.push(TENS[t]);
    if (o > 0) parts.push((fem ? ONES_FEM : ONES)[o]);
  } else if (t === 1) {
    parts.push(TEENS[o]);
  } else if (o > 0) {
    parts.push((fem ? ONES_FEM : ONES)[o]);
  }
  return parts.join(" ");
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Целое число прописью с указанием разрядов (тысячи/миллионы/миллиарды).
 * Тысячи — женский род (одна тысяча, две тысячи).
 */
function integerToWords(value: number): string {
  if (value === 0) return "ноль";

  const groups: number[] = [];
  let n = Math.floor(value);
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }

  const SCALES: Array<{ fem: boolean; forms: [string, string, string] | null }> = [
    { fem: false, forms: null }, // единицы (рубли — склонение добавляется снаружи)
    { fem: true, forms: ["тысяча", "тысячи", "тысяч"] },
    { fem: false, forms: ["миллион", "миллиона", "миллионов"] },
    { fem: false, forms: ["миллиард", "миллиарда", "миллиардов"] },
    { fem: false, forms: ["триллион", "триллиона", "триллионов"] },
  ];

  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    const scale = SCALES[i] ?? SCALES[SCALES.length - 1];
    words.push(tripletToWords(g, scale.fem));
    if (scale.forms) words.push(plural(g, scale.forms));
  }
  return words.join(" ");
}

/**
 * Главная функция. Возвращает строку вида
 * "Семь тысяч восемьсот пятьдесят шесть рублей 80 копеек".
 *
 * @param amount — сумма в рублях (может быть с копейками, e.g. 7856.8)
 */
export function amountInWords(amount: number): string {
  const safe = Math.max(0, Number.isFinite(amount) ? amount : 0);
  const rubles = Math.floor(safe);
  const kopecks = Math.round((safe - rubles) * 100);

  const rublesWords = capitalize(integerToWords(rubles));
  const rublesUnit = plural(rubles, ["рубль", "рубля", "рублей"]);
  const kopecksStr = String(kopecks).padStart(2, "0");
  const kopecksUnit = plural(kopecks, ["копейка", "копейки", "копеек"]);

  return `${rublesWords} ${rublesUnit} ${kopecksStr} ${kopecksUnit}`;
}
