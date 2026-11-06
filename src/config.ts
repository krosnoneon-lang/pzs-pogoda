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

/** Kolejność stała (spec). lat/lon dla skryptu prognozy. */
export const CITIES = [
  { name: "Rzeszów", lat: 50.0413, lon: 21.999 },
  { name: "Krosno", lat: 49.6887, lon: 21.7706 },
  { name: "Przemyśl", lat: 49.7838, lon: 22.7678 },
  { name: "Tarnobrzeg", lat: 50.573, lon: 21.6794 },
  { name: "Polańczyk", lat: 49.3664, lon: 22.418 },
  { name: "Dukla", lat: 49.5553, lon: 21.6826 },
] as const;

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

/** Oś czasu (sekundy) – całość ok. 30 s */
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
  /** start lektora (s) */
  startAt: 0.8,
  volume: 1.0,
  /** głośność muzyki pod lektorem */
  musicUnderVoice: 0.18,
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

/** Własne projekty – rotacja, gdy nie ma sponsora (codziennie inny) */
export const PROJECT_CARDS: EndCard[] = [
  { id: "pzs", kicker: "Prognozę przygotowało dla was", title: "Podkarpacie ze Smakiem", video: "plansze/pzs-logo-anim.mp4", videoSeconds: 3, videoEndFrame: "plansze/pzs-logo-anim-koniec.jpg", videoVolume: 0.7, accent: "magenta" },
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
  time: null as string | null,
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
    // { network: "youtube", storyOnly: false, data: (f) => ({ youtubeData: { title: `Pogoda Podkarpacie ${f.date}`, type: "short", privacy: "public", madeForKids: false } }) },
  ] as Net[],
};
