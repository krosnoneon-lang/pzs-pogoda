/**
 * Pobiera prognozę na DZISIAJ (czas Warszawy) i zapisuje public/data/forecast.json
 * – to są propsy dla kompozycji „PrognozaPogody”.
 *
 *   npx tsx scripts/fetch-forecast.ts                 # prawdziwe dane (MET Norway + IMGW)
 *   npx tsx scripts/fetch-forecast.ts --mock zima     # dane testowe: zima | lato | burza | mgla
 *   npx tsx scripts/fetch-forecast.ts --date 2026-11-07
 *
 * Źródła: MET Norway / yr.no (CC BY 4.0, użycie komercyjne dozwolone z podpisem źródła),
 * IMGW-PIB danepubliczne (ostrzeżenia),
 * wschód/zachód słońca i pełnia liczone lokalnie (astronomy-engine).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as Astronomy from "astronomy-engine";
import { ACTIVE_AD, DEFAULT_CARD, ADS, AD_SCHEDULE, ALL_CARDS, BACKGROUND_MODE, CITIES, KIND_LABEL, PROJECT_CARDS, SUN_CITY } from "../src/config";
import { pickDay, pickMaxim, pickCta } from "../src/dzien";
import type { CityForecast, Forecast, Warning, WeatherKind } from "../src/types";

const TZ = "Europe/Warsaw";
const args = process.argv.slice(2);
const arg = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};

/* ---------- daty w strefie Warszawy ---------- */
const ymd = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(d); // 2026-11-07
const hm = (d: Date) => new Intl.DateTimeFormat("pl-PL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
const DATE = arg("--date") ?? ymd(new Date());

/** północ lokalna jako Date (UTC) */
const localMidnight = (dateStr: string) => {
  const guess = new Date(`${dateStr}T00:00:00Z`);
  const offH = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(guess));
  return new Date(guess.getTime() - (offH > 12 ? offH - 24 : offH) * 3600e3);
};

const DIRS = ["pn.", "pn.-wsch.", "wsch.", "pd.-wsch.", "pd.", "pd.-zach.", "zach.", "pn.-zach."];
const windDir = (deg: number) => DIRS[Math.round(((deg % 360) / 45)) % 8];

/* ---------- TERYT powiatów dla ostrzeżeń IMGW (woj. podkarpackie = 18) ---------- */
const CITY_TERYT: Record<string, string> = {
  Rzeszów: "1863",
  Krosno: "1861",
  Przemyśl: "1862",
  Tarnobrzeg: "1864",
  Polańczyk: "1821", // pow. leski
  Dukla: "1807", // pow. krośnieński
};

async function getJson(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

/* ---------- MET Norway (yr.no): symbole → 9 kategorii ---------- */
const UA = "pzs-prognoza/1.0 (+https://github.com/krosnoneon-lang/pzs-pogoda; podkarpaciezesmakiem.pl)";
const SEV: Record<WeatherKind, number> = { burza: 5, zamiec: 4, snieg: 4, gololedz: 4, deszcz: 3, mgla: 0, pochmurno: 0, czesciowe: 0, slonce: 0 };

export const kindFromSymbol = (sym: string, temp: number): WeatherKind => {
  const s = sym.replace(/_(day|night|polartwilight)$/, "");
  if (s.includes("thunder")) return "burza";
  if (s.includes("snow") || s.includes("sleet")) return "snieg";
  if (s.includes("rain")) return temp <= -1 ? "gololedz" : "deszcz";
  if (s === "fog") return "mgla";
  if (s === "cloudy") return "pochmurno";
  if (s === "partlycloudy") return "czesciowe";
  return "slonce"; // clearsky, fair
};

/** godzina lokalna (Warszawa) „YYYY-MM-DDTHH” z czasu UTC */
const localHour = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .format(new Date(iso)).replace(" ", "T");

type Hour = { h: string; temp: number; wind: number; gust: number; dir: number; sym?: string; pop?: number };

async function fetchMet(lat: number, lon: number): Promise<Hour[]> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`MET Norway ${r.status} ${url}`);
  const j: any = await r.json();
  return j.properties.timeseries.map((t: any) => {
    const d = t.data.instant.details;
    const n1 = t.data.next_1_hours;
    const n6 = t.data.next_6_hours;
    return {
      h: localHour(t.time),
      temp: d.air_temperature,
      wind: d.wind_speed * 3.6,
      gust: (d.wind_speed_of_gust ?? d.wind_speed) * 3.6,
      dir: d.wind_from_direction,
      sym: n1?.summary?.symbol_code ?? n6?.summary?.symbol_code,
      pop: n1?.details?.probability_of_precipitation ?? n6?.details?.probability_of_precipitation,
    };
  });
}

/** Z godzin MET Norway liczymy dzień (06–21), noc (21–06) i ikonę (08–18). */
export function summarize(name: string, hours: Hour[], date: string): CityForecast {
  const nd = nextDay(date);
  const inDay = hours.filter((x) => x.h >= `${date}T06` && x.h <= `${date}T21`);
  const night = hours.filter((x) => x.h >= `${date}T21` && x.h <= `${nd}T06`);
  const core = hours.filter((x) => x.h >= `${date}T08` && x.h <= `${date}T18` && x.sym);
  if (!inDay.length) throw new Error(`Brak danych godzinowych dla ${name} ${date}`);
  const tDay = Math.max(...inDay.map((x) => x.temp));
  const tNight = night.length ? Math.min(...night.map((x) => x.temp)) : Math.min(...inDay.map((x) => x.temp));
  const windMax = inDay.reduce((a, b) => (b.wind > a.wind ? b : a));
  const gust = Math.max(...inDay.map((x) => x.gust));
  const kinds = core.map((x) => kindFromSymbol(x.sym!, x.temp));
  let kind: WeatherKind;
  const wet = kinds.filter((k) => SEV[k] > 0);
  if (wet.length >= 2) kind = wet.sort((a, b) => SEV[b] - SEV[a])[0];
  else {
    const cnt = new Map<WeatherKind, number>();
    kinds.forEach((k) => cnt.set(k, (cnt.get(k) ?? 0) + 1));
    kind = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "pochmurno";
  }
  if (kind === "snieg" && gust >= 50) kind = "zamiec";
  const pops = inDay.map((x) => x.pop).filter((p): p is number => typeof p === "number");
  return {
    name,
    kind,
    tDay: Math.round(tDay),
    tNight: Math.round(tNight),
    pop: Math.round(pops.length ? Math.max(...pops) : 0),
    wind: Math.round(windMax.wind),
    gust: Math.round(gust),
    windDir: windDir(windMax.dir),
  };
}

async function fetchCities(): Promise<CityForecast[]> {
  const out: CityForecast[] = [];
  for (const c of CITIES) {
    out.push(summarize(c.name, await fetchMet(c.lat, c.lon), DATE));
    await new Promise((r) => setTimeout(r, 400)); // spokojnie dla serwera MET
  }
  return out;
}

async function fetchWarnings(): Promise<Warning[]> {
  try {
    const list: any[] = await getJson("https://danepubliczne.imgw.pl/api/data/warningsmeteo");
    const dayStart = localMidnight(DATE).getTime();
    const dayEnd = dayStart + 24 * 3600e3;
    const out: Warning[] = [];
    for (const w of list) {
      const teryt: string[] = (w.teryt ?? []).map(String);
      if (!teryt.some((t) => t.startsWith("18"))) continue;
      const from = Date.parse(String(w.obowiazuje_od).replace(" ", "T"));
      const to = Date.parse(String(w.obowiazuje_do).replace(" ", "T"));
      if (!(from < dayEnd && to > dayStart)) continue;
      const hit = CITIES.filter((c) => teryt.some((t) => t.startsWith(CITY_TERYT[c.name]))).map((c) => c.name);
      const until = to < dayEnd ? ` do ${hm(new Date(to))}` : "";
      const event = `${String(w.nazwa_zdarzenia ?? "Ostrzeżenie").trim()}${until}`;
      const level = Number(w.stopien ?? 1);
      const prev = out.find((o) => o.event === event && o.level === level);
      const area = hit.length ? hit.join(", ") : "część regionu";
      if (prev) prev.area = [...new Set([...prev.area.split(", "), ...area.split(", ")])].filter((a) => a !== "część regionu" || hit.length === 0).join(", ");
      else out.push({ event, level, area });
    }
    return out.sort((a, b) => b.level - a.level).slice(0, 2);
  } catch (e) {
    console.warn("IMGW niedostępne – bez ostrzeżeń:", (e as Error).message);
    return [];
  }
}

function astro() {
  const c = CITIES.find((x) => x.name === SUN_CITY)!;
  const obs = new Astronomy.Observer(c.lat, c.lon, 200);
  const start = localMidnight(DATE);
  const rise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, +1, start, 1);
  const set = Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, -1, start, 1);
  const full = Astronomy.SearchMoonPhase(180, start, 1);
  return {
    sunrise: rise ? hm(rise.date) : "–",
    sunset: set ? hm(set.date) : "–",
    fullMoon: !!full && ymd(full.date) === DATE,
  };
}

function pickBackground(cities: CityForecast[]): WeatherKind {
  const rz = cities[0].kind;
  if (BACKGROUND_MODE === "rzeszow") return rz;
  const count = new Map<WeatherKind, number>();
  cities.forEach((c) => count.set(c.kind, (count.get(c.kind) ?? 0) + 1));
  const max = Math.max(...count.values());
  return count.get(rz) === max ? rz : [...count.entries()].find(([, n]) => n === max)![0];
}

function pickEndCard(): string {
  const sch = AD_SCHEDULE.find((s) => s.from <= DATE && DATE <= s.to && ADS.some((a) => a.id === s.adId));
  if (sch) return sch.adId;
  if (ACTIVE_AD && ADS.some((a) => a.id === ACTIVE_AD)) return ACTIVE_AD;
  if (DEFAULT_CARD && PROJECT_CARDS.some((c) => c.id === DEFAULT_CARD)) return DEFAULT_CARD;
  const doy = Math.floor((Date.parse(DATE) - Date.parse(`${DATE.slice(0, 4)}-01-01`)) / 864e5);
  // w rotacji tylko projekty z gotowym logo / grafiką / animacją – nigdy sam napis
  const ready = PROJECT_CARDS.filter((c) => c.video || c.image || c.logo);
  return ready[doy % ready.length].id;
}

/* ---------- lektor: liczby słownie (ElevenLabs lepiej czyta słowa niż cyfry) ---------- */
const ONES = ["zero", "jeden", "dwa", "trzy", "cztery", "pięć", "sześć", "siedem", "osiem", "dziewięć", "dziesięć", "jedenaście", "dwanaście", "trzynaście", "czternaście", "piętnaście", "szesnaście", "siedemnaście", "osiemnaście", "dziewiętnaście"];
const TENS = ["", "", "dwadzieścia", "trzydzieści", "czterdzieści", "pięćdziesiąt"];
const num = (n: number): string => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : ""));
const tSay = (t: number) => {
  const n = Math.abs(Math.round(t));
  const unit = n === 1 ? "stopień" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "stopnie" : "stopni";
  return `${t < 0 ? "minus " : ""}${num(n)} ${unit}`;
};
/** liczebnik porządkowy w dopełniaczu: „ósmego” (listopada) */
const ORD_GEN = ["", "pierwszego", "drugiego", "trzeciego", "czwartego", "piątego", "szóstego", "siódmego", "ósmego", "dziewiątego", "dziesiątego", "jedenastego", "dwunastego", "trzynastego", "czternastego", "piętnastego", "szesnastego", "siedemnastego", "osiemnastego", "dziewiętnastego", "dwudziestego"];
const dayGen = (d: number) => (d <= 20 ? ORD_GEN[d] : (d < 30 ? "dwudziestego " : "trzydziestego ") + (d % 10 ? ORD_GEN[d % 10] : "")).trim();
const MONTH_GEN = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
/** godzina: „szósta trzydzieści trzy”, „jedenastej” (po „do”) */
const HOUR_GEN = ["północy", "pierwszej", "drugiej", "trzeciej", "czwartej", "piątej", "szóstej", "siódmej", "ósmej", "dziewiątej", "dziesiątej", "jedenastej", "dwunastej", "trzynastej", "czternastej", "piętnastej", "szesnastej", "siedemnastej", "osiemnastej", "dziewiętnastej", "dwudziestej", "dwudziestej pierwszej", "dwudziestej drugiej", "dwudziestej trzeciej"];
const minSay = (m: number) => (m === 0 ? "" : " " + (m < 10 ? "zero " + num(m) : num(m)));
const timeGen = (hm: string) => { const [h, m] = hm.split(":").map(Number); return HOUR_GEN[h] + minSay(m); };
const LOC: Record<string, string> = { "Rzeszów": "w Rzeszowie", "Krosno": "w Krośnie", "Przemyśl": "w Przemyślu", "Tarnobrzeg": "w Tarnobrzegu", "Polańczyk": "w Polańczyku", "Dukla": "w Dukli" };
const KIND_SAY: Record<string, string> = {
  slonce: "Zapowiada się słoneczny dzień", czesciowe: "Czeka nas dzień z przejaśnieniami", pochmurno: "Dzień raczej pochmurny",
  deszcz: "Przyda się parasol – miejscami popada", burza: "Możliwe burze", snieg: "Szykujcie się na śnieg",
  mgla: "Dzień zacznie się we mgle", gololedz: "Uwaga na gołoledź", zamiec: "Uwaga, zamieć śnieżna",
};

/** Tekst dla lektora: zawsze dynamiczne otwarcie, potem prognoza, myśl dnia, pożegnanie. ~25 s. */
function voiceText(f: Omit<Forecast, "voiceoverText">): string {
  const DAYS_PL = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
  const d = new Date(`${f.date}T12:00:00Z`);
  const byT = [...f.cities].sort((a, b) => b.tDay - a.tDay);
  const hot = byT[0], cold = byT[byT.length - 1];
  const rz = f.cities.find((c) => c.name === "Rzeszów") ?? f.cities[0];
  const minNight = Math.min(...f.cities.map((c) => c.tNight));
  const warn = f.warnings.map((w) => w.event.toLowerCase().replace(/do (\d{1,2}:\d{2})/g, (_, t) => "do " + timeGen(t)));
  const parts = [
    `Dzień dobry, Podkarpacie! Dzisiaj ${DAYS_PL[d.getUTCDay()]}, ${dayGen(d.getUTCDate())} ${MONTH_GEN[d.getUTCMonth()]}.`,
    `${KIND_SAY[f.background] ?? KIND_LABEL[f.background]}.`,
    hot.tDay === cold.tDay
      ? `W całym regionie około ${tSay(hot.tDay)}.`
      : `Najcieplej ${LOC[hot.name] ?? hot.name} – ${tSay(hot.tDay)}, najchłodniej ${LOC[cold.name] ?? cold.name} – ${tSay(cold.tDay)}.` +
        (rz !== hot && rz !== cold ? ` W Rzeszowie ${tSay(rz.tDay)}.` : ""),
    minNight <= 0 ? `Nocą przymrozek, nawet ${tSay(minNight)}.` : "",
    warn.length ? `Uwaga, IMGW ostrzega: ${warn.join(" oraz ")}.` : "",
    f.fullMoon ? "A wieczorem na niebie pełnia księżyca." : "",
    f.dayNote ? `Dziś ${f.dayNote}!` : "",
    `Myśl na dziś: ${f.maxim}`,
  ];
  const card = ALL_CARDS().find((c) => c.id === f.endCard);
  if (card && ADS.some((a) => a.id === card.id)) parts.push(`Prognozę przygotował dla was ${card.title}.`);
  return parts.filter(Boolean).join(" ");
}

function nextDay(d: string) {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

/* ---------- dane testowe ---------- */
function mock(scenario: string): { cities: CityForecast[]; warnings: Warning[] } {
  const S: Record<string, [WeatherKind, number, number, number, number, number][]> = {
    zima: [
      ["snieg", 1, -4, 80, 18, 35], ["snieg", 0, -5, 85, 15, 30], ["pochmurno", 2, -3, 40, 20, 38],
      ["czesciowe", 2, -2, 20, 22, 40], ["zamiec", -2, -8, 90, 35, 62], ["snieg", -1, -6, 85, 16, 34],
    ],
    lato: [
      ["slonce", 27, 15, 5, 10, 22], ["slonce", 26, 13, 5, 8, 18], ["czesciowe", 27, 14, 15, 12, 25],
      ["slonce", 28, 15, 5, 11, 21], ["czesciowe", 24, 11, 25, 9, 20], ["slonce", 25, 12, 10, 8, 17],
    ],
    burza: [
      ["burza", 29, 18, 75, 20, 70], ["deszcz", 26, 16, 70, 15, 45], ["burza", 28, 17, 80, 18, 65],
      ["burza", 30, 19, 70, 22, 72], ["deszcz", 24, 14, 85, 14, 40], ["deszcz", 25, 15, 75, 13, 38],
    ],
    mgla: [
      ["mgla", 6, 1, 10, 6, 12], ["mgla", 5, 0, 10, 5, 10], ["pochmurno", 7, 2, 20, 8, 15],
      ["mgla", 6, 1, 10, 6, 11], ["gololedz", 2, -3, 60, 7, 14], ["mgla", 4, -1, 15, 5, 9],
    ],
  };
  const rows = S[scenario] ?? S.zima;
  const dirs = ["zach.", "pd.-zach.", "zach.", "pn.-zach.", "pd.", "zach."];
  const cities = rows.map(([kind, tDay, tNight, pop, wind, gust], i) => ({
    name: CITIES[i].name, kind, tDay, tNight, pop, wind, gust, windDir: dirs[i],
  }));
  const warnings: Warning[] =
    scenario === "zima" ? [{ event: "Intensywne opady śniegu", level: 1, area: "Polańczyk, Dukla" }]
    : scenario === "burza" ? [{ event: "Burze z gradem", level: 2, area: "Rzeszów, Przemyśl, Tarnobrzeg" }]
    : scenario === "mgla" ? [{ event: "Gęsta mgła", level: 1, area: "część regionu" }, { event: "Oblodzenie", level: 1, area: "Polańczyk" }]
    : [];
  return { cities, warnings };
}

async function main() {
  const mockScenario = args.includes("--mock") ? arg("--mock") ?? "zima" : null;
  const { cities, warnings } = mockScenario ? mock(mockScenario) : { cities: await fetchCities(), warnings: await fetchWarnings() };
  const a = astro();
  const base = {
    date: DATE,
    cities,
    background: pickBackground(cities),
    sunrise: a.sunrise,
    sunset: a.sunset,
    fullMoon: args.includes("--pelnia") ? true : a.fullMoon,
    warnings,
    endCard: arg("--plansza") ?? pickEndCard(),
    dayNote: pickDay(DATE),
    maxim: pickMaxim(DATE),
    voiceover: fs.existsSync(path.join(__dirname, "..", "public", "data", "lektor.mp3")),
    source: mockScenario ? `DANE TESTOWE (${mockScenario})` : "Dane: MET Norway (CC BY 4.0) · ostrzeżenia: IMGW-PIB",
  };
  const forecast: Forecast = { ...base, voiceoverText: voiceText(base), ctaText: pickCta(DATE), cta: false };
  const out = path.join(__dirname, "..", "public", "data", "forecast.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(forecast, null, 2));
  console.log(`Zapisano ${out}`);
  console.log(JSON.stringify(forecast, null, 2));
}

if (process.argv[1]?.includes("fetch-forecast")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
