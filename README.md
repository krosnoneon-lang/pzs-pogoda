# PZS – Prognoza pogody Stories (Remotion)

Codzienne pionowe wideo (1080×1920, 30 kl./s, ok. 30 s) z prognozą dla 6 miejscowości,
publikowane jako Stories na FB Podkarpacie ze Smakiem. Specyfikacja: Notion
„PZS | Prognoza pogody Stories – specyfikacja szablonu i automatyzacji”.

## Oś czasu (ok. 30 s)
0–15 s prognoza (logo, data, 6 miast, słońce/pełnia/ostrzeżenia) → 15–22 s „Na dobry początek dnia”
(święto dnia + myśl na dziś, plik `src/dzien.ts`) → 22–30 s reklama albo projekt.
Lektor: skrypt co dzień zapisuje `voiceoverText` w forecast.json; gdy dodamy plik `public/data/lektor.mp3`,
odtworzy się sam, a muzyka ściszy się pod głos.

## Co edytujesz – tylko `src/config.ts`
- `CITIES` – miasta i kolejność, `SUN_CITY` – miasto dla wschodu/zachodu słońca
- `BACKGROUNDS` – 9 plików teł w `public/tla/` (nazwy jak na Dysku: 01_slonce.png … 09_zamiec.png)
- `LOGO` – `public/logo/pzs-logo-biale.png` (całe białe, także „ze smakiem”)
- `MUSIC` – `public/muzyka/skyline-portfolio.wav`, `enabled: true` po wgraniu
- `TIMING` – długości ujęć
- `ADS` – karty reklam; `ACTIVE_AD` – reklama lecąca codziennie DO MOMENTU ZMIANY;
  `AD_SCHEDULE` – kampanie z datami (mają pierwszeństwo); brak obu → rotacja `PROJECT_CARDS`
- `PUBLISH` – sieci w Metricool (FB Stories; IG/TikTok/YouTube gotowe do odkomentowania) i godzina publikacji

## Uruchomienie lokalnie
```bash
npm i
npm run prognoza:test        # dane testowe (zima); też: npx tsx scripts/fetch-forecast.ts --mock lato|burza|mgla --pelnia
npm run prognoza             # prawdziwa prognoza (MET Norway + IMGW)
npx remotion studio          # podgląd
npm run render               # out/prognoza.mp4
```

## Dane
- Prognoza: MET Norway / yr.no (api.met.no, bez klucza, CC BY 4.0 – użycie komercyjne dozwolone z podpisem „Dane: MET Norway”, podpis jest na ekranie). Dzień = maks. 06–21, noc = min. 21–06, ikona = pogoda przeważająca 08–18 (opady/burza mają pierwszeństwo).
- Ikony: symbole MET → 9 kategorii (deszcz przy ≤ −1 °C = gołoledź, śnieg z porywami ≥ 50 km/h = zamieć).
- Tło: kategoria dominująca w regionie (remis → Rzeszów); przełącznik `BACKGROUND_MODE`.
- Ostrzeżenia IMGW: woj. podkarpackie, ważne danego dnia, maks. 2 najwyższe stopnie.
- Wschód/zachód słońca i pełnia: liczone lokalnie (astronomy-engine).

## Automatyzacja (GitHub Actions → Metricool)
`.github/workflows/prognoza.yml` – codziennie 00:01 czasu warszawskiego (obsługuje zmianę czasu):
prognoza → render → film jako publiczny plik (GitHub Release, sprzątanie po 7 dniach) → Metricool.
GitHub NIE dostaje dostępu do Facebooka/TikToka – tylko token API Metricool.

Konfiguracja repozytorium (Settings → Secrets and variables → Actions):
- Secret `METRICOOL_USER_TOKEN` – token z Metricool (ustawienia konta → API)
- Variable `METRICOOL_ENABLED` = `true`
- Variable `METRICOOL_MODE` = `draft` (szkic w planerze do zatwierdzenia) → po testach `publish`
- (opcjonalnie) `METRICOOL_BLOG_ID` = 7029617, `METRICOOL_USER_ID` = 5428059 – już domyślne
- Filmy muszą mieć publiczny adres: repozytorium publiczne ALBO osobne publiczne repo na filmy
  (Variable `MEDIA_REPO` = `konto/pzs-media`, Secret `MEDIA_REPO_TOKEN` z prawem zapisu do niego)

Test bez wysyłania: `npm run metricool:test`. Każdy przebieg zostawia film jako artefakt w zakładce Actions (14 dni).

Licencja Remotion: darmowa dla osób prywatnych i firm do 3 osób; większe firmy potrzebują licencji firmowej (remotion.pro).
