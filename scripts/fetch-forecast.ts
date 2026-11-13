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
import { ACTIVE_AD, DEFAULT_CARD, ADS, AD_SCHEDULE, BACKGROUND_MODE, CITIES, EXTRA_CITIES, PROJECT_CARDS, REGION_LOC, SUN_CITY } from "../src/config";
import { pickDay, pickMaxim, pickCta, pickImieniny, imionaSay } from "../src/dzien";
import type { CityForecast, Forecast, Lektor, MapaInfo, Warning, WeatherKind } from "../src/types";

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
  "Stalowa Wola": "1818",
  Mielec: "1811",
  Leżajsk: "1808",
  Dębica: "1803",
  Łańcut: "1810",
  Jarosław: "1804",
  Lubaczów: "1809",
  Jasło: "1805",
  Sanok: "1817",
  "Ustrzyki Dolne": "1801", // pow. bieszczadzki
  "Ustrzyki Górne": "1801",
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
    windDeg: Math.round(windMax.dir),
  };
}

async function fetchCities(list: readonly { name: string; lat: number; lon: number }[] = CITIES): Promise<CityForecast[]> {
  const out: CityForecast[] = [];
  for (const c of list) {
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
const DAYS_PL = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
const FROM_DIR = ["z północy", "z północnego wschodu", "ze wschodu", "z południowego wschodu", "z południa", "z południowego zachodu", "z zachodu", "z północnego zachodu"];
const fromDir = (deg: number) => FROM_DIR[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
const WET: Record<string, { sev: number; say: string }> = {
  burza: { sev: 6, say: "możliwe burze" }, zamiec: { sev: 5, say: "zamieć śnieżna" }, gololedz: { sev: 5, say: "uwaga na gołoledź" },
  snieg: { sev: 4, say: "pada śnieg" }, deszcz: { sev: 3, say: "popada deszcz" }, mgla: { sev: 2, say: "gęste mgły" },
};
const loc = (name: string) => CITIES.find((c) => c.name === name)?.loc ?? `w ${name}`;
/** „do pięćdziesięciu pięciu kilometrów na godzinę” (dopełniacz) */
const GEN_T: Record<number, string> = { 10: "dziesięciu", 20: "dwudziestu", 30: "trzydziestu", 40: "czterdziestu", 50: "pięćdziesięciu", 60: "sześćdziesięciu", 70: "siedemdziesięciu", 80: "osiemdziesięciu", 90: "dziewięćdziesięciu" };
const kmh = (n: number) => {
  const r = Math.min(120, Math.max(10, Math.round(n / 5) * 5));
  const t = Math.floor(r / 10) * 10;
  const w = r >= 100 ? "stu" + (r > 100 ? " " + (GEN_T[r - 100] ?? "") : "") : (r % 10 === 5 ? (r === 15 ? "piętnastu" : `${GEN_T[t]} pięciu`) : GEN_T[t]);
  return `${w.trim()} kilometrów na godzinę`;
};

/** Wersja 2: lektor w trzech częściach + informacje dla mapy (co pokazać i kiedy). */
function buildV2(f: Omit<Forecast, "voiceoverText">): { lektor: Lektor; mapa: MapaInfo } {
  const d = new Date(`${f.date}T12:00:00Z`);
  const imiona = (f.imieniny?.length ? ` Imieniny obchodzą ${imionaSay(f.imieniny)}.` : "") + (f.sponsor ? ` Sponsorem pogody jest ${f.sponsor.lektor}.` : "");
  const intro = [
    `Dzień dobry, Podkarpacie! Dzisiaj ${DAYS_PL[d.getUTCDay()]}, ${dayGen(d.getUTCDate())} ${MONTH_GEN[d.getUTCMonth()]}.${imiona}`,
    `Słońce wstaje o ${timeGen(f.sunrise)}, a zachodzi o ${timeGen(f.sunset)}.`,
    f.dayNote ? `Dziś ${f.dayNote}!` : "",
    f.fullMoon ? "Wieczorem pełnia księżyca." : "",
  ].filter(Boolean).join(" ");

  // dzień: najcieplej / najchłodniej
  const byD = [...f.cities].sort((a, b) => b.tDay - a.tDay);
  const hot = byD[0], cold = byD[byD.length - 1];
  const dzien = hot.tDay === cold.tDay
    ? `W dzień w całym regionie około ${tSay(hot.tDay)}.`
    : `W dzień najcieplej ${loc(hot.name)} – ${tSay(hot.tDay)}, najchłodniej ${loc(cold.name)} – ${tSay(cold.tDay)}.`;

  // wiatr: przeważający kierunek (średnia wektorowa), porywy
  let vx = 0, vy = 0;
  f.cities.forEach((c) => { const r = ((c.windDeg ?? 270) * Math.PI) / 180; vx += Math.sin(r) * c.wind; vy += Math.cos(r) * c.wind; });
  const windDeg = (Math.round((Math.atan2(vx, vy) * 180) / Math.PI) + 360) % 360;
  const windAvg = f.cities.reduce((a, c) => a + c.wind, 0) / f.cities.length;
  const gustMax = f.cities.reduce((a, c) => (c.gust > a.gust ? c : a));
  const wiatr = windAvg < 8 ? "Wiatr słaby." :
    `Wieje ${fromDir(windDeg)}${gustMax.gust >= 45 ? `, w porywach do ${kmh(gustMax.gust)} ${loc(gustMax.name)}` : ""}.`;

  // opady / zjawiska: pogrupowane po regionach
  const wet = f.cities.filter((c) => WET[c.kind]);
  let zjawisko: MapaInfo["zjawisko"] = null;
  let opady: string;
  if (!wet.length) opady = "Bez opadów.";
  else if (wet.length >= f.cities.length * 0.75) {
    const k = [...wet].sort((a, b) => WET[b.kind].sev - WET[a.kind].sev)[0].kind;
    opady = `W całym regionie ${WET[k].say}.`;
    zjawisko = { kind: k, text: `W całym regionie ${WET[k].say}`, lon: 22.2, lat: 49.85 };
  } else {
    const groups = new Map<string, { kind: WeatherKind; cities: string[] }>();
    for (const c of wet) {
      const reg = CITIES.find((x) => x.name === c.name)!.region;
      const g = groups.get(reg);
      if (!g || WET[c.kind].sev > WET[g.kind].sev) groups.set(reg, { kind: c.kind, cities: [...(g?.cities ?? []), c.name] });
      else g.cities.push(c.name);
    }
    const parts = [...groups.entries()].sort((a, b) => WET[b[1].kind].sev - WET[a[1].kind].sev);
    const say = parts.slice(0, 2).map(([reg, g]) => (g.cities.length === 1 ? `${loc(g.cities[0])} ${WET[g.kind].say}` : `${REGION_LOC[reg]} ${WET[g.kind].say}`));
    opady = say.map((x, i) => (i === 0 ? x[0].toUpperCase() + x.slice(1) : x)).join(", a ") + (wet.length < f.cities.length / 2 ? ", poza tym sucho." : ".");
    const [reg, g] = parts[0];
    const pts = CITIES.filter((c) => g.cities.includes(c.name));
    zjawisko = {
      kind: g.kind,
      text: (g.cities.length === 1 ? `${loc(g.cities[0])} ${WET[g.kind].say}` : `${REGION_LOC[reg]} ${WET[g.kind].say}`).replace(/^./, (x) => x.toUpperCase()),
      lon: pts.reduce((a, c) => a + c.lon, 0) / pts.length,
      lat: pts.reduce((a, c) => a + c.lat, 0) / pts.length,
    };
  }

  // noc
  const byN = [...f.cities].sort((a, b) => a.tNight - b.tNight);
  const frost = f.cities.filter((c) => c.tNight <= 0).length;
  const noc = `W nocy najzimniej ${loc(byN[0].name)} – ${tSay(byN[0].tNight)}` +
    (frost >= f.cities.length * 0.6 ? ", przymrozki w większości regionu." : frost ? "." : `, najcieplej ${loc(byN[byN.length - 1].name)} – ${tSay(byN[byN.length - 1].tNight)}.`);
  const ostrz = warningsSay(f.warnings);

  // kolejność: dzień → wiatr → opady (zbliżenie) → noc; czas faz wg długości zdań
  const segs = [dzien + " " + wiatr, zjawisko ? opady : "", noc + ostrz];
  const total = segs.reduce((a, x) => a + x.length, 0) + (zjawisko ? 0 : opady.length);
  const l0 = (segs[0].length + (zjawisko ? 0 : opady.length)) / total;
  const l1 = segs[1].length / total;
  const mapaText = zjawisko ? `${segs[0]} ${opady} ${segs[2]}` : `${segs[0]} ${opady} ${segs[2]}`;
  return {
    // myśl dnia wyłączona – w to miejsce wejdzie kiedyś reklama
    lektor: { intro, mapa: mapaText },
    mapa: {
      zjawisko,
      windDeg,
      windAvg: Math.round(windAvg),
      fazy: zjawisko
        ? { dzien: [0, l0], zjawisko: [l0, l0 + l1], noc: [l0 + l1, 1] }
        : { dzien: [0, l0], zjawisko: null, noc: [l0, 1] },
    },
  };
}

/** Tekst dla lektora (wersja 1, cały ciągiem) – zostaje dla zgodności */
function voiceText(f: Omit<Forecast, "voiceoverText">): string {
  const v = buildV2(f);
  return `${v.lektor.intro} ${v.lektor.mapa}`;
}

function nextDay(d: string) {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

/* ---------- dane testowe (17 miejscowości; wiersz = region) ---------- */
type Row = [WeatherKind, number, number, number, number, number, number]; // kind, tDay, tNight, pop, wind, gust, windDeg
/* ---------- ostrzeżenia IMGW dla lektora ----------
 * Zasada: lektor zawsze mówi, GDZIE obowiązuje które ostrzeżenie. Ostrzeżenia łączone są po rejonach;
 * jeśli w jednym rejonie jest i deszcz, i śnieg → „deszcz ze śniegiem”. Wspólna godzina końca mówiona raz.
 */
const WARN_KIND: [RegExp, string, string][] = [
  [/deszcz/i, "deszcz", "intensywnym deszczem"],
  [/śnieg|snieg/i, "snieg", "opadami śniegu"],
  [/wiatr/i, "wiatr", "silnym wiatrem"],
  [/burz/i, "burza", "burzami"],
  [/mróz|mroz/i, "mroz", "mrozem"],
  [/oblodz|gołoled|goloted/i, "lod", "oblodzeniem dróg"],
  [/mgł|mgl/i, "mgla", "gęstymi mgłami"],
  [/upał|upal/i, "upal", "upałem"],
];
function warningsSay(ws: Warning[]): string {
  if (!ws.length) return "";
  const regOf = (n: string) => (CITIES.find((c) => c.name === n.trim()) as { region?: string } | undefined)?.region;
  const allRegs = [...new Set(CITIES.map((c) => c.region))];
  // rejon → zestaw rodzajów zjawisk
  const per = new Map<string, Map<string, string>>();
  const hours = new Set<string>();
  for (const w of ws) {
    const k = WARN_KIND.find(([re]) => re.test(w.event));
    const key = k ? k[1] : w.event.toLowerCase();
    const say = k ? k[2] : w.event.toLowerCase().replace(/\s*do \d{1,2}:\d{2}.*/, "");
    const h = w.event.match(/do (\d{1,2}:\d{2})/)?.[1];
    hours.add(h ?? "");
    const regs = [...new Set(w.area.split(",").map(regOf).filter(Boolean) as string[])];
    for (const r of regs.length ? regs : allRegs) {
      if (!per.has(r)) per.set(r, new Map());
      per.get(r)!.set(key, say);
    }
  }
  // opis zjawisk w rejonie
  const label = (m: Map<string, string>) => {
    const keys = [...m.keys()];
    const parts: string[] = [];
    if (m.has("deszcz") && m.has("snieg")) parts.push("deszczem ze śniegiem");
    for (const k of keys) if (!((k === "deszcz" || k === "snieg") && m.has("deszcz") && m.has("snieg"))) parts.push(m.get(k)!);
    return parts.length > 1 ? parts.slice(0, -1).join(", ") + " i " + parts[parts.length - 1] : parts[0];
  };
  const groups = new Map<string, string[]>();
  for (const r of allRegs) if (per.has(r)) { const l = label(per.get(r)!); groups.set(l, [...(groups.get(l) ?? []), r]); }
  const where = (rs: string[]) => (rs.length === allRegs.length ? "w całym regionie" : rs.map((r) => REGION_LOC[r]).join(rs.length > 2 ? ", " : " i ").replace(/, ([^,]*)$/, " i $1"));
  const items = [...groups.entries()].map(([l, rs]) => `${where(rs)} przed ${l}`);
  const hs = [...hours].filter(Boolean);
  const kiedy = hs.length === 1 && hours.size === 1 ? ` do ${timeGen(hs[0])}` : "";
  const txt = items.length > 1 ? items.slice(0, -1).join(", ") + ", a " + items[items.length - 1] : items[0];
  return ` Uwaga,${kiedy} IMGW ostrzega ${txt}.`;
}

function mock(scenario: string): { cities: CityForecast[]; warnings: Warning[]; extra: CityForecast[] } {
  const R: Record<string, Record<string, Row>> = {
    listopad: {
      polnoc: ["pochmurno", 7, 1, 20, 18, 34, 270], centrum: ["czesciowe", 8, 1, 15, 20, 38, 265], wschod: ["slonce", 9, 2, 5, 16, 30, 260],
      pogorze: ["deszcz", 6, -1, 70, 22, 45, 250], bieszczady: ["snieg", 2, -4, 85, 26, 52, 240],
    },
    zima: {
      polnoc: ["czesciowe", 1, -6, 20, 15, 30, 300], centrum: ["snieg", 0, -5, 80, 18, 35, 290], wschod: ["pochmurno", 0, -6, 40, 16, 32, 300],
      pogorze: ["snieg", -1, -7, 85, 20, 40, 280], bieszczady: ["zamiec", -4, -11, 90, 35, 65, 270],
    },
    lato: {
      polnoc: ["slonce", 28, 15, 5, 10, 22, 90], centrum: ["slonce", 27, 14, 5, 9, 20, 100], wschod: ["czesciowe", 27, 14, 15, 12, 25, 120],
      pogorze: ["burza", 26, 13, 60, 12, 55, 200], bieszczady: ["burza", 23, 11, 70, 10, 50, 210],
    },
    mgla: {
      polnoc: ["mgla", 6, 1, 10, 5, 10, 180], centrum: ["mgla", 6, 0, 10, 5, 10, 180], wschod: ["pochmurno", 7, 2, 20, 8, 15, 200],
      pogorze: ["mgla", 5, -1, 15, 5, 9, 190], bieszczady: ["gololedz", 2, -3, 60, 7, 14, 210],
    },
  };
  const S = R[scenario] ?? R.listopad;
  const DIRS8 = ["pn.", "pn.-wsch.", "wsch.", "pd.-wsch.", "pd.", "pd.-zach.", "zach.", "pn.-zach."];
  const cities = CITIES.map((c, i) => {
    const [kind, tDay, tNight, pop, wind, gust, deg] = S[c.region];
    const j = (i % 3) - 1; // drobne różnice między miastami regionu
    return { name: c.name, kind, tDay: tDay + j, tNight: tNight + (i % 2 ? -1 : 0), pop, wind: wind + j * 2, gust, windDir: DIRS8[Math.round(deg / 45) % 8], windDeg: deg + j * 8 };
  });
  // najwyżej położone: chłodniej
  const ug = cities.find((c) => c.name === "Ustrzyki Górne")!; ug.tDay -= 1; ug.tNight -= 1;
  const warnings: Warning[] =
    scenario === "zima" ? [{ event: "Intensywne opady śniegu", level: 1, area: "Ustrzyki Górne, Polańczyk" }]
    : scenario === "lato" ? [{ event: "Burze z gradem", level: 2, area: "Krosno, Sanok, Ustrzyki Dolne" }]
    : scenario === "mgla" ? [{ event: "Gęsta mgła", level: 1, area: "część regionu" }]
    : [];
  const extra = EXTRA_CITIES.map((c, i) => {
    const [kind, tDay, tNight, pop, wind, gust, deg] = S[c.region];
    const j = (i % 3) - 1;
    return { name: c.name, kind, tDay: tDay + j, tNight: tNight + (i % 2 ? -1 : 0), pop, wind: wind + j * 2, gust, windDir: DIRS8[Math.round(deg / 45) % 8], windDeg: deg + j * 8 };
  });
  return { cities, warnings: process.env.MOCK_WARN ? JSON.parse(process.env.MOCK_WARN) : warnings, extra };
}

async function main() {
  const mockScenario = args.includes("--mock") ? arg("--mock") ?? "listopad" : null;
  const { cities, warnings, extra } = mockScenario
    ? mock(mockScenario)
    : { cities: await fetchCities(), warnings: await fetchWarnings(), extra: await fetchCities(EXTRA_CITIES).catch(() => [] as CityForecast[]) };
  const a = astro();
  const sp = path.join(__dirname, "..", "public", "data", "sponsor.json");
  const sponsor = fs.existsSync(sp) ? JSON.parse(fs.readFileSync(sp, "utf8")) : null;
  const base = {
    date: DATE,
    cities,
    extra,
    background: pickBackground(cities),
    sunrise: a.sunrise,
    sunset: a.sunset,
    fullMoon: args.includes("--pelnia") ? true : a.fullMoon,
    warnings,
    sponsor,
    endCard: arg("--plansza") ?? (sponsor ? "sponsor" : pickEndCard()),
    dayNote: pickDay(DATE),
    maxim: pickMaxim(DATE),
    imieniny: pickImieniny(DATE),
    voiceover: fs.existsSync(path.join(__dirname, "..", "public", "data", "lektor.mp3")),
    source: mockScenario ? `DANE TESTOWE (${mockScenario})` : "Dane: MET Norway (CC BY 4.0) · ostrzeżenia: IMGW-PIB",
  };
  const v2 = buildV2(base);
  const forecast: Forecast = { ...base, voiceoverText: voiceText(base), lektor: v2.lektor, mapa: v2.mapa, ctaText: pickCta(DATE), cta: false };
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
