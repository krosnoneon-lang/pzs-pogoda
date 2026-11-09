/**
 * „Na dobry początek dnia” – treści do planszy i (w przyszłości) do lektora.
 * Oba zbiory edytujesz tutaj. Klucz dnia: "MM-DD".
 * Święta ruchome (Wielkanoc, Boże Ciało itp.) dopisz ręcznie na dany rok w EXTRA_DAYS.
 */
import { IMIENINY } from "./imieniny";

export const DAYS: Record<string, string> = {
  "01-01": "Nowy Rok",
  "01-21": "Dzień Babci",
  "01-22": "Dzień Dziadka",
  "02-14": "Walentynki",
  "03-08": "Dzień Kobiet",
  "03-20": "Międzynarodowy Dzień Szczęścia",
  "03-21": "Pierwszy dzień wiosny",
  "03-22": "Światowy Dzień Wody",
  "04-07": "Światowy Dzień Zdrowia",
  "04-22": "Dzień Ziemi",
  "05-01": "Święto Pracy",
  "05-03": "Święto Konstytucji 3 Maja",
  "05-04": "Dzień Strażaka",
  "05-20": "Światowy Dzień Pszczół",
  "05-26": "Dzień Matki",
  "06-01": "Dzień Dziecka",
  "06-05": "Światowy Dzień Środowiska",
  "06-23": "Dzień Ojca",
  "08-15": "Święto Wojska Polskiego",
  "09-22": "Europejski Dzień bez Samochodu",
  "09-30": "Dzień Chłopaka",
  "10-01": "Międzynarodowy Dzień Kawy",
  "10-04": "Światowy Dzień Zwierząt",
  "10-14": "Dzień Edukacji Narodowej",
  "11-01": "Wszystkich Świętych",
  "11-11": "Narodowe Święto Niepodległości",
  "11-21": "Światowy Dzień Życzliwości i Pozdrowień",
  "11-25": "Dzień Pluszowego Misia",
  "12-05": "Międzynarodowy Dzień Wolontariusza",
  "12-06": "Mikołajki",
  "12-24": "Wigilia",
  "12-25": "Boże Narodzenie",
  "12-26": "Drugi dzień Świąt",
  "12-31": "Sylwester",
};

/** Daty konkretnego roku: "YYYY-MM-DD" → tekst (ma pierwszeństwo przed DAYS) */
export const EXTRA_DAYS: Record<string, string> = {
  // "2027-03-28": "Wielkanoc",
};

/** Maksymy – polskie przysłowia (domena publiczna). Rotacja według dnia roku. */
export const MAXIMS: string[] = [
  "Kto rano wstaje, temu Pan Bóg daje.",
  "Gdzie dwóch się bije, tam trzeci korzysta.",
  "Lepszy wróbel w garści niż gołąb na dachu.",
  "Kropla drąży skałę.",
  "Bez pracy nie ma kołaczy.",
  "Co nagle, to po diable.",
  "Prawdziwych przyjaciół poznaje się w biedzie.",
  "Darowanemu koniowi nie zagląda się w zęby.",
  "Gość w dom, Bóg w dom.",
  "Kto pyta, nie błądzi.",
  "Nie chwal dnia przed zachodem słońca.",
  "Śpiesz się powoli.",
  "Ziarnko do ziarnka, a zbierze się miarka.",
  "Mądry Polak po szkodzie – bądź mądry przed.",
  "Wszędzie dobrze, ale w domu najlepiej.",
  "Jak sobie pościelesz, tak się wyśpisz.",
  "Nie od razu Kraków zbudowano.",
  "Czego się Jaś nie nauczy, tego Jan nie będzie umiał.",
  "Dobre słowo nic nie kosztuje, a wiele daje.",
  "Kto sieje wiatr, zbiera burzę – siej życzliwość.",
  "Uśmiech nic nie kosztuje.",
  "Dzień bez uśmiechu jest dniem straconym.",
  "Kto ma wiedzę, ten ma moc.",
  "Lepiej późno niż wcale.",
  "Apetyt rośnie w miarę jedzenia.",
  "Zgoda buduje, niezgoda rujnuje.",
  "Cierpliwość jest gorzka, ale jej owoc słodki.",
  "Nie ma tego złego, co by na dobre nie wyszło.",
  "Każdy jest kowalem swojego losu.",
  "Pierwsze koty za płoty.",
  "Co masz zrobić jutro, zrób dziś.",
];

export const pickDay = (dateIso: string): string | null =>
  EXTRA_DAYS[dateIso] ?? DAYS[dateIso.slice(5)] ?? null;

/**
 * Imieniny – lektor czyta je zaraz po dacie: „…dziesiątego listopada, imieniny obchodzą Andrzej i Ludomir.”
 * Lista na cały rok jest w src/imieniny.ts (generowana, nie edytuj). Tu ustawiasz tylko:
 *   IMIENINY_ILE      – ile imion czyta lektor (1–3)
 *   IMIENINY_RECZNIE  – własne imiona na wybrany dzień, klucz "MM-DD" (wygrywa z listą); [] = nie czytaj imienin
 */
export const IMIENINY_ILE = 2;
export const IMIENINY_RECZNIE: Record<string, string[]> = {
  // "11-10": ["Leon", "Andrzej"],
};

export const pickImieniny = (dateIso: string, ile = IMIENINY_ILE): string[] => {
  const k = dateIso.slice(5);
  return (IMIENINY_RECZNIE[k] ?? IMIENINY[k]?.lektor ?? []).slice(0, Math.max(0, ile));
};

/** „Andrzej i Ludomir”, „Jan, Żaneta i Maksym” */
export const imionaSay = (names: string[]): string =>
  names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} i ${names[names.length - 1]}`;

/** Myśl dnia ustawiona ręcznie na konkretną datę (wygrywa z listą MAXIMS) */
export const MAXIM_OVERRIDE: Record<string, string> = {
  "2026-11-08": "Niedziela to taki dzień, w którym kawa smakuje lepiej, a nikt nie pyta, która godzina.",
};

export const pickMaxim = (dateIso: string): string => {
  if (MAXIM_OVERRIDE[dateIso]) return MAXIM_OVERRIDE[dateIso];
  const doy = Math.floor((Date.parse(dateIso) - Date.parse(`${dateIso.slice(0, 4)}-01-01`)) / 864e5);
  return MAXIMS[doy % MAXIMS.length];
};

/** Wezwanie do działania na końcu (lektor mówi je na planszy z logo PzS). Rotacja codziennie. */
export const CTAS: string[] = [
  "Zostawcie serduszko, wyślijcie prognozę znajomym i obserwujcie Podkarpacie ze smakiem!",
  "Przyda się komuś? Wyślijcie mu tę prognozę – i obserwujcie Podkarpacie ze smakiem!",
  "Obserwujcie Podkarpacie ze smakiem – codziennie rano pogoda i dobre słowo na start. Zostawcie serduszko!",
];
const BYE = ["Miłej niedzieli!", "Udanego tygodnia!", "Miłego dnia!", "Miłego dnia!", "Miłego dnia!", "Udanego piątku!", "Udanej soboty!"];
export const pickCta = (dateIso: string): string => {
  const d = new Date(`${dateIso}T12:00:00Z`);
  const doy = Math.floor((Date.parse(dateIso) - Date.parse(`${dateIso.slice(0, 4)}-01-01`)) / 864e5);
  return `${CTAS[doy % CTAS.length]} ${BYE[d.getUTCDay()]}`;
};
