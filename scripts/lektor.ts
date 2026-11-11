/**
 * Lektor: public/data/lektor.mp3 (prognoza + myśl dnia) i lektor-cta.mp3 (wezwanie na planszy z logo).
 *   LEKTOR_URL, LEKTOR_CTA_URL – gotowe nagrania (pobierz zamiast generować)
 *   ELEVENLABS_API_KEY         – sekret; generuje głosem z config VOICEOVER
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { VOICEOVER } from "../src/config";

const root = path.join(__dirname, "..", "public");
const fj = path.join(root, "data", "forecast.json");

async function tts(text: string): Promise<Buffer> {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICEOVER.voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: VOICEOVER.model, language_code: "pl", voice_settings: VOICEOVER.settings }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${await r.text()}`);
  return Buffer.from(await r.arrayBuffer());
}
async function download(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Pobieranie ${url.slice(0, 60)}…: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
const duration = (file: string): number | undefined => {
  // ffprobe dostarczany z Remotion (na runnerze GitHuba systemowego może nie być)
  for (const cmd of [`npx remotion ffprobe`, `ffprobe`]) {
    try {
      const out = execSync(`${cmd} -v error -show_entries format=duration -of csv=p=0 "${file}"`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim().split("\n").pop();
      const n = Number(out);
      if (n > 0) return n;
    } catch { /* następna próba */ }
  }
  return undefined;
};

async function main() {
  const f = JSON.parse(fs.readFileSync(fj, "utf8"));
  const key = !!process.env.ELEVENLABS_API_KEY;
  // WERSJA 2 (mapa): trzy osobne nagrania – plansza, mapa, myśl dnia – żeby sceny zmieniały się dokładnie po zdaniach
  if (f.lektor && key) {
    f.lektorSec = {};
    for (const part of ["intro", "mapa", "mysl"] as const) {
      const p = path.join(root, "data", `lektor-${part}.mp3`);
      fs.writeFileSync(p, await tts(f.lektor[part]));
      f.lektorSec[part] = duration(p);
      console.log(`Lektor ${part} (${f.lektorSec[part]?.toFixed(1)} s):`, f.lektor[part]);
    }
    f.voiceover = true;
    if (f.ctaText) {
      const p = path.join(root, VOICEOVER.ctaFile);
      fs.writeFileSync(p, await tts(f.ctaText));
      f.cta = true; f.ctaSec = duration(p);
    }
    fs.writeFileSync(fj, JSON.stringify(f, null, 2));
    return;
  }
  const main = process.env.LEKTOR_URL ? await download(process.env.LEKTOR_URL) : key ? await tts(f.voiceoverText) : null;
  const cta = process.env.LEKTOR_CTA_URL ? await download(process.env.LEKTOR_CTA_URL) : key && f.ctaText ? await tts(f.ctaText) : null;
  if (!main && !cta) { console.log("Brak klucza ELEVENLABS_API_KEY i nagrań – film bez lektora."); return; }
  console.log("Lektor:", f.voiceoverText, "\nCTA:", f.ctaText);
  if (main) {
    const p = path.join(root, VOICEOVER.file); fs.writeFileSync(p, main);
    f.voiceover = true; f.voiceSec = duration(p);
  }
  if (cta) {
    const p = path.join(root, VOICEOVER.ctaFile); fs.writeFileSync(p, cta);
    f.cta = true; f.ctaSec = duration(p);
  }
  fs.writeFileSync(fj, JSON.stringify(f, null, 2));
  console.log(`Długość: lektor ${f.voiceSec?.toFixed(1)} s, CTA ${f.ctaSec?.toFixed(1)} s`);
}
main().catch((e) => { console.error(e); process.exit(1); });
