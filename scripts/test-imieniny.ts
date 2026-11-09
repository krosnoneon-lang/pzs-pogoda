/**
 * Kontrola listy imienin: npm run imieniny:test
 * Sprawdza, czy każdy dzień roku (z 29 lutego) ma imiona dla lektora i czy dane są czyste.
 */
import { IMIENINY } from "../src/imieniny";
import { IMIENINY_ILE, IMIENINY_RECZNIE, imionaSay, pickImieniny } from "../src/dzien";

const errors: string[] = [];
const days: string[] = [];
for (let m = 1; m <= 12; m++) {
  const n = new Date(Date.UTC(2024, m, 0)).getUTCDate(); // 2024 – rok przestępny, więc jest 29 lutego
  for (let d = 1; d <= n; d++) days.push(`${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
}

if (Object.keys(IMIENINY).length !== 366) errors.push(`Dni w pliku: ${Object.keys(IMIENINY).length} (powinno być 366)`);
for (const k of days) {
  const e = IMIENINY[k];
  if (!e) { errors.push(`${k}: brak dnia`); continue; }
  if (e.lektor.length < IMIENINY_ILE) errors.push(`${k}: za mało imion dla lektora (${e.lektor.length})`);
  for (const name of [...e.lektor, ...e.wszystkie]) {
    if (!/^\p{Lu}[\p{Ll}]+( \p{Lu}[\p{Ll}]+)?$/u.test(name)) errors.push(`${k}: dziwny zapis imienia „${name}”`);
  }
  if (new Set(e.wszystkie).size !== e.wszystkie.length) errors.push(`${k}: powtórzone imię`);
  if (!e.lektor.every((n) => e.wszystkie.includes(n))) errors.push(`${k}: imię lektora spoza pełnej listy`);
}
for (const [k, v] of Object.entries(IMIENINY_RECZNIE)) {
  if (!days.includes(k)) errors.push(`IMIENINY_RECZNIE: zły klucz „${k}” (format MM-DD)`);
  if (!Array.isArray(v)) errors.push(`IMIENINY_RECZNIE ${k}: oczekiwana lista imion`);
}

// przykłady
const sample = ["2026-11-10", "2026-12-24", "2026-12-31", "2028-02-29", "2027-01-01"];
for (const d of sample) console.log(d, "→", `imieniny obchodzą ${imionaSay(pickImieniny(d))}`);
if (imionaSay(["Jan", "Żaneta", "Maksym"]) !== "Jan, Żaneta i Maksym") errors.push("imionaSay: zły format");

if (errors.length) {
  console.error(`\n${errors.length} błędów:\n` + errors.slice(0, 50).join("\n"));
  process.exit(1);
}
console.log(`\nOK: 366 dni, lektor czyta ${IMIENINY_ILE} imiona, ręcznych poprawek: ${Object.keys(IMIENINY_RECZNIE).length}.`);
