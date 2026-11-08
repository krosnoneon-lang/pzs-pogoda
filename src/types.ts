/** Kategorie pogody = 9 teł z Dysku + ikony. Numer = prefiks pliku tła (01_…png). */
export type WeatherKind =
  | "slonce"
  | "czesciowe"
  | "pochmurno"
  | "deszcz"
  | "burza"
  | "snieg"
  | "mgla"
  | "gololedz"
  | "zamiec";

export type CityForecast = {
  name: string;
  kind: WeatherKind;
  /** temperatura maks. w dzień (°C) */
  tDay: number;
  /** temperatura min. w nocy, następna noc (°C) */
  tNight: number;
  /** szansa opadów, % */
  pop: number;
  /** wiatr średni maks., km/h (−1 = brak danych, nie pokazujemy) */
  wind: number;
  /** porywy, km/h */
  gust: number;
  /** kierunek wiatru, skrót PL: N, NE, E… → „pn.”, itp. */
  windDir: string;
};

export type Warning = {
  /** np. „Oblodzenie”, „Burze z gradem” */
  event: string;
  level: number;
  /** krótko gdzie, np. „pow. krośnieński, leski” albo „część regionu” */
  area: string;
};

export type Forecast = {
  /** ISO data dnia prognozy (czas lokalny), np. 2026-11-07 */
  date: string;
  cities: CityForecast[];
  /** tło całego ekranu */
  background: WeatherKind;
  sunrise: string; // "06:41"
  sunset: string; // "16:04"
  fullMoon: boolean;
  warnings: Warning[];
  /** id planszy końcowej z config.ts (sponsor albo projekt) */
  endCard: string;
  /** „Dziś jest…” – święto / dzień tematyczny albo null */
  dayNote: string | null;
  /** maksyma dnia */
  maxim: string;
  /** czy jest nagrany lektor na ten dzień (public/data/lektor.mp3) */
  voiceover: boolean;
  /** tekst dla lektora (ElevenLabs) – generowany automatycznie */
  voiceoverText: string;
  /** wezwanie do działania – lektor na planszy końcowej */
  ctaText?: string;
  /** czy jest nagrane CTA (public/data/lektor-cta.mp3) */
  cta?: boolean;
  /** długości nagrań w sekundach (do dopasowania tempa) */
  voiceSec?: number;
  ctaSec?: number;
  /** źródło danych – mały podpis */
  source: string;
};
