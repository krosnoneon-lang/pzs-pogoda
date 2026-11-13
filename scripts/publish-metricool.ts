/**
 * Publikacja przez Metricool (bez dostępu do Facebooka/TikToka w GitHubie).
 *
 *   npx tsx scripts/publish-metricool.ts <publiczny-URL-wideo>
 *
 * Zmienne środowiskowe (GitHub → Settings → Secrets / Variables):
 *   METRICOOL_USER_TOKEN  – token API z ustawień konta Metricool (sekret)
 *   METRICOOL_USER_ID     – 5428059
 *   METRICOOL_BLOG_ID     – 7029617 (marka „Podkarpacie ze smakiem”)
 *   METRICOOL_MODE        – "draft" (domyślnie: szkic w planerze do zatwierdzenia) | "publish"
 *
 * Sieci i godzina publikacji: PUBLISH w src/config.ts.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { PUBLISH } from "../src/config";
import type { Forecast } from "../src/types";

const API = "https://app.metricool.com/api";
const videoUrl = process.argv[2];
const env = (k: string, def?: string) => {
  const v = process.env[k] ?? def;
  if (!v) throw new Error(`Brak zmiennej ${k}`);
  return v;
};

/** "YYYY-MM-DDTHH:mm:ss" w strefie Warszawy */
const warsawLocal = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(d).replace(" ", "T");

function publicationTime(forecastDate: string): string {
  const soon = warsawLocal(new Date(Date.now() + PUBLISH.minDelayMinutes * 60e3));
  if (!PUBLISH.time) return soon;
  const wanted = `${forecastDate}T${PUBLISH.time}:00`;
  return wanted > soon ? wanted : soon; // data nie może być w przeszłości
}

async function main() {
  if (!videoUrl?.startsWith("https://")) throw new Error("Podaj publiczny adres https:// wideo");
  const f: Forecast = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "data", "forecast.json"), "utf8"));
  const mode = env("METRICOOL_MODE", "draft");
  const caption = PUBLISH.caption(f);

  // osobny wpis dla każdej sieci – błąd jednej (np. YouTube) nie blokuje drugiej (Story na FB)
  const url = `${API}/v2/scheduler/posts?blogId=${env("METRICOOL_BLOG_ID")}&userId=${env("METRICOOL_USER_ID")}`;
  const when = publicationTime(f.date);
  const errors: string[] = [];
  for (const n of PUBLISH.networks) {
    const body: Record<string, unknown> = {
      publicationDate: { dateTime: when, timezone: "Europe/Warsaw" },
      providers: [{ network: n.network }],
      media: [videoUrl],
      saveExternalMediaFiles: true,
      autoPublish: true,
      draft: mode !== "publish",
      shortener: false,
      text: n.storyOnly ? "" : caption, // Stories nie mają opisu
      ...n.data(f, caption),
    };
    if (process.env.METRICOOL_DRY === "1") {
      console.log(`DRY RUN (${n.network}) – nic nie wysyłam:`);
      console.log(JSON.stringify(body, null, 2));
      continue;
    }
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Mc-Auth": env("METRICOOL_USER_TOKEN") },
      body: JSON.stringify(body),
    });
    const txt = await r.text();
    if (!r.ok) { errors.push(`${n.network}: Metricool ${r.status}: ${txt.slice(0, 300)}`); console.error(errors[errors.length - 1]); continue; }
    console.log(`Metricool OK – ${n.network} (${mode === "publish" ? "zaplanowano publikację" : "szkic w planerze"}) na ${when}`);
  }
  if (errors.length === PUBLISH.networks.length) throw new Error(errors.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
