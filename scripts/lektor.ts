/**
 * Lektor: public/data/lektor.mp3 z forecast.voiceoverText i ustawienie voiceover=true.
 *   LEKTOR_URL=https://…mp3   – gotowe nagranie (pobierz zamiast generować)
 *   ELEVENLABS_API_KEY        – sekret; generuje głosem VOICE (config VOICEOVER.voiceId)
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { VOICEOVER } from "../src/config";

const root = path.join(__dirname, "..", "public");
const fj = path.join(root, "data", "forecast.json");
const out = path.join(root, VOICEOVER.file);

async function main() {
  const f = JSON.parse(fs.readFileSync(fj, "utf8"));
  let buf: Buffer;
  if (process.env.LEKTOR_URL) {
    const r = await fetch(process.env.LEKTOR_URL);
    if (!r.ok) throw new Error(`Pobieranie lektora: ${r.status}`);
    buf = Buffer.from(await r.arrayBuffer());
  } else if (process.env.ELEVENLABS_API_KEY) {
    console.log("Tekst lektora:", f.voiceoverText);
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICEOVER.voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text: f.voiceoverText, model_id: VOICEOVER.model, language_code: "pl", voice_settings: VOICEOVER.settings }),
    });
    if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${await r.text()}`);
    buf = Buffer.from(await r.arrayBuffer());
  } else {
    console.log("Brak LEKTOR_URL i ELEVENLABS_API_KEY – film bez lektora.");
    return;
  }
  fs.writeFileSync(out, buf);
  f.voiceover = true;
  fs.writeFileSync(fj, JSON.stringify(f, null, 2));
  console.log(`Lektor zapisany (${Math.round(buf.length / 1024)} KB).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
