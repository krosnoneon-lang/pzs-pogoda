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

  const providers = PUBLISH.networks.map((n) => ({ network: n.network }));
  const body: Record<string, unknown> = {
    publicationDate: { dateTime: publicationTime(f.date), timezone: "Europe/Warsaw" },
    providers,
    media: [videoUrl],
    saveExternalMediaFiles: true,
    autoPublish: true,
    draft: mode !== "publish",
    shortener: false,
    // Stories nie mają opisu – tekst idzie tylko do sieci, które go mają (TikTok, Reels, YouTube)
    text: PUBLISH.networks.every((n) => n.storyOnly) ? "" : caption,
  };
  for (const n of PUBLISH.networks) Object.assign(body, n.data(f, caption));

  if (process.env.METRICOOL_DRY === "1") {
    console.log("DRY RUN – nic nie wysyłam. Treść żądania:");
    console.log(JSON.stringify(body, null, 2));
    return;
  }
  const url = `${API}/v2/scheduler/posts?blogId=${env("METRICOOL_BLOG_ID")}&userId=${env("METRICOOL_USER_ID")}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Mc-Auth": env("METRICOOL_USER_TOKEN") },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Metricool ${r.status}: ${txt}`);
  console.log(`Metricool OK (${mode === "publish" ? "zaplanowano publikację" : "szkic w planerze"}) na ${(body.publicationDate as any).dateTime}`);
  console.log(txt.slice(0, 500));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
