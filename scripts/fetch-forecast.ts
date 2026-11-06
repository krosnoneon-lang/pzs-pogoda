/**
 * Pobiera prognozę na DZISIAJ (czas Warszawy) i zapisuje public/data/forecast.json
 * – to są propsy dla kompozycji „PrognozaPogody”.
 *
 *   npx tsx scripts/fetch-forecast.ts                 # prawdziwe dane (Open-Meteo + IMGW)
 *   npx tsx scripts/fetch-forecast.ts --mock zima     # dane testowe: zima | lato | burza | mgla
 *   npx tsx scripts/fetch-forecast.ts --date 2026-11-07
 *
 * Źródła: Open-Meteo (bez klucza), IMGW-PIB danepubliczne (ostrzeżenia),
 * wschód/zachód słońca i pełnia liczone lokalnie (astronomy-engine).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as Astronomy from "astronomy-engine";
import { ACTIVE_AD, ADS, AD_SCHEDULE, ALL_CARDS, BACKGROUND_MODE, CITIES, KIND_LABEL, PROJECT_CARDS, SUN_CITY } from "../src/config";
import { pickDay, pickMaxim } from "../src/dzien";
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

/* ---------- kody WMO → 9 kategorii ---------- */
export const kindFromWmo = (code: number, tMin: number, gust: number): WeatherKind => {
  const snowy = [71, 73, 75, 77, 85, 86].includes(code);
  if (snowy && gust >= 50) return "zamiec";
  if (snowy) return "snieg";
  if ([56, 57, 66, 67].includes(code)) return "gololedz";
  if ([95, 96, 99].includes(code)) return "burza";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return tMin <= -1 ? "gololedz" : "deszcz";
  if ([45, 48].includes(code)) return "mgla";
  if (code === 3) return "pochmurno";
  if (code === 2) return "czesciowe";
  return "slonce"; // 0, 1
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
  const r = await fetch(url, { headers: { "User-Agent": "pzs-prognoza/1.0" } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

/**
 * Kod pogody „na dzień” z godzin 08–18 zamiast dziennego kodu Open-Meteo (ten bierze
 * najgorszy stan doby, więc sama poranna mgła oznaczała cały dzień jako mglisty).
 * Opady/burza w ciągu dnia wygrywają; poza tym – stan, który trwa najdłużej.
 */
const SEVERITY = (c: number) => ([95, 96, 99].includes(c) ? 5 : c >= 71 && c <= 86 && ![80, 81, 82].includes(c) ? 4 : [56, 57, 66, 67].includes(c) ? 4 : c >= 51 ? 3 : 0);
function dayCode(d: any): number {
  const codes: number[] = d.hourly.time
    .map((t: string, k: number) => ({ t, c: d.hourly.weather_code[k] }))
    .filter((x: { t: string }) => x.t >= `${DATE}T08:00` && x.t <= `${DATE}T18:00`)
    .map((x: { c: number }) => x.c);
  if (!codes.length) return d.daily.weather_code[d.daily.time.indexOf(DATE)];
  const wet = codes.filter((c) => SEVERITY(c) > 0);
  if (wet.length >= 2) return wet.sort((a, b) => SEVERITY(b) - SEVERITY(a) || b - a)[0];
  const count = new Map<number, number>();
  codes.forEach((c) => count.set(c, (count.get(c) ?? 0) + 1));
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

async function fetchCities(): Promise<CityForecast[]> {
  const lat = CITIES.map((c) => c.lat).join(",");
  const lon = CITIES.map((c) => c.lon).join(",");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant` +
    `&hourly=temperature_2m,weather_code&timezone=${encodeURIComponent(TZ)}&start_date=${DATE}&end_date=${nextDay(DATE)}&wind_speed_unit=kmh`;
  const data = await getJson(url);
  const arr = Array.isArray(data) ? data : [data];
  return arr.map((d: any, i: number) => {
    const day = d.daily;
    const di = day.time.indexOf(DATE);
    // noc: 21:00 dziś → 06:00 jutro
    const hrs: number[] = d.hourly.time
      .map((t: string, k: number) => ({ t, v: d.hourly.temperature_2m[k] }))
      .filter((x: { t: string }) => x.t >= `${DATE}T21:00` && x.t <= `${nextDay(DATE)}T06:00`)
      .map((x: { v: number }) => x.v);
    const tMinDay = day.temperature_2m_min[di];
    const gust = Math.round(day.wind_gusts_10m_max[di]);
    return {
      name: CITIES[i].name,
      kind: kindFromWmo(dayCode(d), tMinDay, gust),
      tDay: Math.round(day.temperature_2m_max[di]),
      tNight: Math.round(hrs.length ? Math.min(...hrs) : tMinDay),
      pop: Math.round(day.precipitation_probability_max[di] ?? 0),
      wind: Math.round(day.wind_speed_10m_max[di]),
      gust,
      windDir: windDir(day.wind_direction_10m_dominant[di]),
    };
  });
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
      const event = String(w.nazwa_zdarzenia ?? "Ostrzeżenie").trim();
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
  const doy = Math.floor((Date.parse(DATE) - Date.parse(`${DATE.slice(0, 4)}-01-01`)) / 864e5);
  return PROJECT_CARDS[doy % PROJECT_CARDS.length].id;
}

const tSay = (t: number) => {
  const n = Math.abs(t);
  const unit = n === 1 ? "stopień" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "stopnie" : "stopni";
  return `${t < 0 ? "minus " : ""}${n} ${unit}`;
};

/** Tekst dla lektora – bez wymieniania wszystkich liczb, ogólnie i miło */
function voiceText(f: Omit<Forecast, "voiceoverText">): string {
  const DAYS_PL = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
  const d = new Date(`${f.date}T12:00:00Z`);
  const rz = f.cities[0];
  const parts = [
    `Dzień dobry, Podkarpacie! Dziś ${DAYS_PL[d.getUTCDay()]}.`,
    `${KIND_LABEL[f.background]} w większości regionu. W Rzeszowie w dzień do ${tSay(rz.tDay)}, w nocy ${tSay(rz.tNight)}.`,
    f.warnings.length ? `Uwaga, IMGW ostrzega: ${f.warnings.map((w) => w.event.toLowerCase()).join(" oraz ")}.` : "",
    f.fullMoon ? "A wieczorem na niebie pełnia księżyca." : "",
    f.dayNote ? `Dziś obchodzimy: ${f.dayNote}.` : "",
    `Myśl na dziś: ${f.maxim}`,
  ];
  const card = ALL_CARDS().find((c) => c.id === f.endCard);
  if (card && ADS.some((a) => a.id === card.id)) parts.push(`Prognozę przygotował dla was ${card.title}.`);
  parts.push("Miłego dnia!");
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
    source: mockScenario ? `DANE TESTOWE (${mockScenario})` : "Open-Meteo · IMGW-PIB",
  };
  const forecast: Forecast = { ...base, voiceoverText: voiceText(base) };
  const out = path.join(__dirname, "..", "public", "data", "forecast.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(forecast, null, 2));
  console.log(`Zapisano ${out}`);
  console.log(JSON.stringify(forecast, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
