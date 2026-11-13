/**
 * PROGNOZA POGODY STORIES – JEDYNY PLIK DO EDYCJI
 * Spec: Notion „PZS | Prognoza pogody Stories – specyfikacja szablonu i automatyzacji”.
 * Układ jest stały. Tutaj zmieniasz: miasta, kolory, czasy, pliki, sponsora i rotację plansz.
 */
import type { Forecast, WeatherKind } from "./types";

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** Bezpieczne strefy Stories: góra (pasek postępu, nazwa profilu) i dół (pole odpowiedzi) */
export const SAFE = { top: 250, bottom: 300, side: 64 };

/** Miejscowości na mapie pogody (wersja 2, XI 2026): wszystkie strefy województwa.
 *  region – do opisu opadów przez lektora; dol – karta pod punktem (gdy miasta są blisko); loc – „w …” dla lektora */
export const CITIES = [
  { name: "Tarnobrzeg", lat: 50.5729, lon: 21.6792, region: "polnoc", loc: "w Tarnobrzegu", dol: true },
  { name: "Stalowa Wola", lat: 50.5653, lon: 22.0644, region: "polnoc", loc: "w Stalowej Woli" },
  { name: "Mielec", lat: 50.2895, lon: 21.4229, region: "polnoc", loc: "w Mielcu" },
  { name: "Leżajsk", lat: 50.2622, lon: 22.4189, region: "polnoc", loc: "w Leżajsku" },
  { name: "Rzeszów", lat: 50.0413, lon: 21.999, region: "centrum", loc: "w Rzeszowie" },
  { name: "Dębica", lat: 50.0515, lon: 21.4105, region: "centrum", loc: "w Dębicy" },
  { name: "Łańcut", lat: 50.0691, lon: 22.2321, region: "centrum", loc: "w Łańcucie", dol: true },
  { name: "Jarosław", lat: 50.0159, lon: 22.6797, region: "wschod", loc: "w Jarosławiu" },
  { name: "Przemyśl", lat: 49.7838, lon: 22.7678, region: "wschod", loc: "w Przemyślu", dol: true },
  { name: "Lubaczów", lat: 50.1574, lon: 23.1226, region: "wschod", loc: "w Lubaczowie" },
  { name: "Krosno", lat: 49.6887, lon: 21.7706, region: "pogorze", loc: "w Krośnie" },
  { name: "Jasło", lat: 49.747, lon: 21.4743, region: "pogorze", loc: "w Jaśle", dol: true },
  { name: "Dukla", lat: 49.5553, lon: 21.6826, region: "pogorze", loc: "w Dukli", dol: true },
  { name: "Sanok", lat: 49.5609, lon: 22.207, region: "pogorze", loc: "w Sanoku" },
  { name: "Ustrzyki Dolne", lat: 49.4302, lon: 22.5877, region: "bieszczady", loc: "w Ustrzykach Dolnych" },
  { name: "Polańczyk", lat: 49.3664, lon: 22.418, region: "bieszczady", loc: "w Polańczyku", dol: true },
  { name: "Ustrzyki Górne", lat: 49.1052, lon: 22.6492, region: "bieszczady", loc: "w Ustrzykach Górnych", dol: true },
] as const;

/** Miejscowości pokazywane TYLKO na zbliżeniu mapy (stolice powiatów + miejsca turystyczne). Współrzędne z OSM. */
export const EXTRA_CITIES = [
  { name: "Lesko", lat: 49.4689, lon: 22.3304, region: "bieszczady" },
  { name: "Wetlina", lat: 49.1552, lon: 22.469, region: "bieszczady" },
  { name: "Cisna", lat: 49.2132, lon: 22.3283, region: "bieszczady" },
  { name: "Baligród", lat: 49.3368, lon: 22.2866, region: "bieszczady" },
  { name: "Komańcza", lat: 49.3361, lon: 22.0698, region: "bieszczady" },
  { name: "Solina", lat: 49.3997, lon: 22.4499, region: "bieszczady" },
  { name: "Brzozów", lat: 49.695, lon: 22.0197, region: "pogorze" },
  { name: "Iwonicz-Zdrój", lat: 49.5697, lon: 21.7932, region: "pogorze" },
  { name: "Rymanów-Zdrój", lat: 49.5498, lon: 21.8513, region: "pogorze" },
  { name: "Zagórz", lat: 49.5099, lon: 22.2633, region: "pogorze" },
  { name: "Krempna", lat: 49.5103, lon: 21.5031, region: "pogorze" },
  { name: "Strzyżów", lat: 49.8702, lon: 21.7856, region: "centrum" },
  { name: "Ropczyce", lat: 50.0529, lon: 21.6116, region: "centrum" },
  { name: "Kolbuszowa", lat: 50.2433, lon: 21.7755, region: "centrum" },
  { name: "Głogów Młp.", lat: 50.1512, lon: 21.9628, region: "centrum" },
  { name: "Dynów", lat: 49.8135, lon: 22.2338, region: "centrum" },
  { name: "Nisko", lat: 50.5199, lon: 22.1399, region: "polnoc" },
  { name: "Nowa Dęba", lat: 50.4135, lon: 21.7541, region: "polnoc" },
  { name: "Rudnik n. Sanem", lat: 50.4448, lon: 22.244, region: "polnoc" },
  { name: "Przeworsk", lat: 50.0602, lon: 22.4924, region: "wschod" },
  { name: "Radymno", lat: 49.9517, lon: 22.8183, region: "wschod" },
  { name: "Krasiczyn", lat: 49.7762, lon: 22.6522, region: "wschod" },
  { name: "Bircza", lat: 49.6912, lon: 22.4804, region: "wschod" },
  { name: "Arłamów", lat: 49.5781, lon: 22.6674, region: "wschod" },
  { name: "Horyniec-Zdrój", lat: 50.191, lon: 23.3626, region: "wschod" },
] as const;

export const REGION_LOC: Record<string, string> = {
  polnoc: "na północy regionu",
  centrum: "w centrum regionu",
  wschod: "na wschodzie",
  pogorze: "na Pogórzu",
  bieszczady: "w Bieszczadach",
};

/** Scena mapy: minimalne długości (s), gdy brak lektora */
export const MAPA = {
  intro: 6.5,
  mapa: 12,
  /** wiatr pokazujemy strzałkami od tej prędkości (km/h) */
  windMin: 0,
};

/** Miasto, dla którego podajemy wschód/zachód słońca */
export const SUN_CITY = "Rzeszów";

/** Jak dobierać tło: "dominujaca" (najczęstsza w regionie, remis → Rzeszów) albo "rzeszow" */
export const BACKGROUND_MODE: "dominujaca" | "rzeszow" = "dominujaca";

/** Pliki teł z Dysku (wrzucić do public/tla/). Brak pliku → tło tymczasowe. */
export const BACKGROUNDS: Record<WeatherKind, string> = {
  slonce: "tla/01_slonce.png",
  czesciowe: "tla/02_czesciowe_zachmurzenie.png",
  pochmurno: "tla/03_pochmurno.png",
  deszcz: "tla/04_deszcz.png",
  burza: "tla/05_burza.png",
  snieg: "tla/06_snieg.png",
  mgla: "tla/07_mgla.png",
  gololedz: "tla/08_gololedz.png",
  zamiec: "tla/09_zamiec.png",
};

export const KIND_LABEL: Record<WeatherKind, string> = {
  slonce: "Słonecznie",
  czesciowe: "Częściowe zachmurzenie",
  pochmurno: "Pochmurno",
  deszcz: "Deszcz",
  burza: "Burze",
  snieg: "Śnieg",
  mgla: "Mgła",
  gololedz: "Gołoledź",
  zamiec: "Zamieć śnieżna",
};

/** Logo: CAŁE białe (z „ze smakiem” też białym) – zasada z briefu. */
export const LOGO = {
  file: "logo/pzs-logo-biale.png",
  /** szerokość logo na ekranie, px */
  width: 480,
};

/** Kolory marki (neon): magenta + błękit; biel na tekst */
export const COLORS = {
  white: "#FFFFFF",
  muted: "rgba(255,255,255,0.72)",
  magenta: "#FF3C9E",
  blue: "#5CD6F6",
  warn: "#FFC23D",
  panel: "rgba(8,14,28,0.55)",
  panelLine: "rgba(255,255,255,0.14)",
};

export const FONT_FAMILY = "PZS Montserrat";

/** Muzyka: pierwsze sekundy pliku, wyciszenie na końcu filmu */
export const MUSIC = {
  /** włącz po wgraniu pliku muzyki */
  enabled: true,
  file: "muzyka/skyline-portfolio.wav",
  /** od której sekundy pliku startujemy (spec: początek, spokojniejsza część) */
  startAt: 0,
  volume: 0.8,
  fadeOutSeconds: 1.5,
};

/** Oś czasu (sekundy) – wersja 1 (lista miast). Wersja 2 (mapa) używa MAPA i długości nagrań lektora. */
export const TIMING = {
  /** wejście tła, logo i daty */
  intro: 1.2,
  /** odstęp między wejściem kolejnych miast */
  cityStagger: 0.25,
  /** ile prognoza stoi po wejściu wszystkich miast (czas na przeczytanie) */
  hold: 12.5,
  /** plansza „Na dobry początek dnia”: święto + maksyma */
  morning: 7.5,
  /** plansza reklamy / projektu */
  endCard: 8.0,
  /** przenikanie między planszami */
  crossfade: 0.6,
};

/** Lektor (wersja 2): plik public/data/lektor.mp3 generowany co dzień z voiceoverText */
export const VOICEOVER = {
  file: "data/lektor.mp3",
  /** CTA na planszy z logo */
  ctaFile: "data/lektor-cta.mp3",
  /** start CTA od początku planszy końcowej (s) – po dźwięku logo */
  ctaStartAt: 1.0,
  /** głośność dźwięku animacji logo, gdy leci CTA */
  logoVolumeUnderCta: 0.3,
  /** maksymalne przyspieszenie lektora, gdy nagranie jest za długie */
  maxRate: 1.15,
  /** start lektora (s) */
  startAt: 0.8,
  volume: 1.0,
  /** głośność muzyki pod lektorem */
  musicUnderVoice: 0.18,
  /** ElevenLabs: Jacek Placek (dynamiczny, reklamowy) */
  voiceId: "fbNqWJ0FaV9a6IT2gr16",
  model: "eleven_multilingual_v2",
  settings: { stability: 0.4, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true, speed: 1.1 },
};

/* ------------------------------------------------------------------ */
/* PLANSZA KOŃCOWA: sponsor albo rotacja własnych projektów             */
/* ------------------------------------------------------------------ */

export type EndCard = {
  id: string;
  /** mała linia nad nazwą, np. „Prognozę przygotował dla was” */
  kicker: string;
  title: string;
  subtitle?: string;
  /** gotowa grafika planszy 1080×1920 (public/plansze/…) – jeśli jest, zastępuje typografię */
  image?: string;
  /** animacja 1080×1920 (public/plansze/…): gra raz, potem stoi ostatnia klatka `videoEndFrame` */
  video?: string;
  videoSeconds?: number;
  videoEndFrame?: string;
  /** głośność dźwięku animacji (0 = bez) */
  videoVolume?: number;
  /** "cover" = pełny ekran (grafika 1080×1920), "contain" = grafika pozioma na środku planszy */
  imageFit?: "cover" | "contain";
  /** logo sponsora / projektu (public/plansze/…) */
  logo?: string;
  accent: "magenta" | "blue";
};

/** Własne projekty – rotacja, gdy nie ma sponsora (codziennie inny).
 *  W rotacji są TYLKO karty z logo / grafiką / animacją (video, image, logo). Karta z samym tekstem nie poleci. */
export const PROJECT_CARDS: EndCard[] = [
  { id: "pzs", kicker: "", title: "Podkarpacie ze Smakiem", video: "plansze/pzs-logo-anim.mp4", videoSeconds: 3, videoEndFrame: "plansze/pzs-logo-anim-koniec.jpg", videoVolume: 0.7, accent: "magenta" },
  { id: "studio", kicker: "Zapraszamy do", title: "Studio ze Smakiem", subtitle: "Rozmowy z ludźmi ze smakiem", accent: "blue" },
  { id: "odbij", kicker: "Akcja społeczna", title: "Odbij z ekranu", accent: "magenta" },
  { id: "via", kicker: "Projekt Podkarpacia ze Smakiem", title: "Via Carpatia", accent: "blue" },
  { id: "dawniej", kicker: "Projekt Podkarpacia ze Smakiem", title: "Podkarpacie Dawniej", accent: "magenta" },
];

/** Reklamy – karty sponsorów. Dodajesz raz, potem tylko wskazujesz id. */
export const ADS: EndCard[] = [
  // { id: "sponsor-x", kicker: "Prognozę przygotował dla was", title: "Nazwa Firmy", subtitle: "hasło / adres", logo: "plansze/sponsor-x-logo.png", accent: "blue" },
];

/**
 * KTÓRA REKLAMA LECI:
 * 1) HARMONOGRAM – wpis obejmujący dzisiejszą datę wygrywa (np. kampania na miesiąc),
 * 2) AKTYWNA_REKLAMA – leci codziennie DO MOMENTU ZMIANY (null = brak),
 * 3) brak obu → rotacja własnych projektów (codziennie inny).
 */
export const AD_SCHEDULE: { from: string; to: string; adId: string }[] = [
  // { from: "2026-12-01", to: "2026-12-24", adId: "sponsor-x" },
];
export const ACTIVE_AD: string | null = null;
/** Gdy nie ma reklamy: stała plansza (DO ODWOŁANIA – animacja logo Podkarpacie ze Smakiem).
 *  null = rotacja własnych projektów (tylko te z logo/grafiką). */
export const DEFAULT_CARD: string | null = "pzs";

export const ALL_CARDS = (): EndCard[] => [...PROJECT_CARDS, ...ADS];

/* ------------------------------------------------------------------ */
/* PUBLIKACJA PRZEZ METRICOOL                                          */
/* ------------------------------------------------------------------ */
type Net = {
  network: "facebook" | "instagram" | "tiktok" | "youtube";
  /** Stories nie mają opisu */
  storyOnly: boolean;
  data: (f: Forecast, caption: string) => Record<string, unknown>;
};

export const PUBLISH = {
  /**
   * Godzina publikacji (czas Warszawy) w dniu prognozy, np. "06:00".
   * null = zaraz po wyrenderowaniu (ok. 00:15). Stories wiszą 24 h od publikacji.
   */
  time: "06:00" as string | null,
  /** minimalny zapas od „teraz” – Metricool nie przyjmie daty z przeszłości */
  minDelayMinutes: 5,
  /** opis dla sieci, które go mają (TikTok, Reels, YouTube Shorts) */
  caption: (f: Forecast) =>
    `Prognoza pogody na Podkarpaciu ${f.date.split("-").reverse().join(".")} ☀️🌧️❄️ Rzeszów, Krosno, Przemyśl, Tarnobrzeg, Polańczyk, Dukla. #pogoda #Podkarpacie #PodkarpacieZeSmakiem`,
  /** sieci – odkomentuj po podpięciu w Metricool (marka „Podkarpacie ze smakiem”) */
  networks: [
    { network: "facebook", storyOnly: true, data: () => ({ facebookData: { type: "STORY" } }) },
    // { network: "instagram", storyOnly: true, data: () => ({ instagramData: { type: "STORY" } }) },
    // { network: "tiktok", storyOnly: false, data: () => ({ tiktokData: { privacyOption: "PUBLIC_TO_EVERYONE", disableComment: false, disableDuet: false, disableStitch: false } }) },
    // {
    //   network: "youtube",
    //   storyOnly: false,
    //   data: (f) => ({
    //     youtubeData: {
    //       title: `Pogoda na Podkarpaciu ${f.date.split("-").reverse().slice(0, 2).join(".")} – prognoza na dziś #shorts`,
    //       type: "short",
    //       privacy: "public",
    //       madeForKids: false,
    //       category: "NEWS_POLITICS",
    //       tags: ["pogoda", "Podkarpacie", "prognoza pogody", "Rzeszów", "Krosno", "Przemyśl", "Bieszczady"],
    //     },
    //   }),
    // },
  ] as Net[],
};
