/**
 * SPONSOR POGODY – który sponsor leci dzisiaj.
 *
 * Źródło (pierwsze dostępne):
 *  1) arkusz Google „Harmonogram sponsorów pogody” (zmienna SPONSOR_SHEET_ID; arkusz udostępniony „każdy z linkiem – przeglądający”),
 *  2) plik public/sponsorzy/harmonogram.json w repozytorium (zapas / wersja bez arkusza).
 *
 * Wynik: public/data/sponsor.json (null = dziś bez sponsora) i logo w public/data/sponsor-logo.png.
 * Uruchomienie: npx tsx scripts/sponsor.ts [--date RRRR-MM-DD]
 */
import fs from "node:fs";
import path from "node:path";

export type Sponsor = {
  id: string;
  nazwa: string;
  lektor: string;
  logo?: string; // ścieżka w public/ (np. data/sponsor-logo.png) albo link do Dysku
  lat: number;
  lon: number;
  podpis?: string;
  haslo?: string;
  aktywny: boolean;
};
type Wpis = { od: string; do: string; id: string };

const root = path.join(__dirname, "..", "public");
const args = process.argv.slice(2);
const arg = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const DATE = arg("--date") ?? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());

/* ---------- CSV ---------- */
function csv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** „2026-12-01” albo „1.12.2026” → „2026-12-01” */
const normDate = (s: string) => {
  const t = s.trim();
  const m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : t;
};
/** „49.5553, 21.6826” (z Google Maps) → [lat, lon] */
const coords = (s: string): [number, number] | null => {
  const n = s.match(/-?\d+[.,]\d+/g);
  if (!n || n.length < 2) return null;
  return [Number(n[0].replace(",", ".")), Number(n[1].replace(",", "."))];
};
const driveId = (s: string) => s.match(/\/d\/([\w-]{20,})/)?.[1] ?? s.match(/[?&]id=([\w-]{20,})/)?.[1] ?? null;

async function fromSheet(id: string): Promise<{ sponsorzy: Sponsor[]; harmonogram: Wpis[] }> {
  const get = async (tab: string) => {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`);
    if (!r.ok) throw new Error(`Arkusz (${tab}): HTTP ${r.status} – czy arkusz jest udostępniony „każdy z linkiem”?`);
    return csv(await r.text()).slice(1);
  };
  const sponsorzy: Sponsor[] = [];
  for (const r of await get("Sponsorzy")) {
    const c = coords(r[4] ?? "");
    if (!r[0]?.trim() || !c) continue;
    sponsorzy.push({ id: r[0].trim(), nazwa: r[1]?.trim() || r[0].trim(), lektor: r[2]?.trim() || r[1]?.trim() || r[0].trim(), logo: r[3]?.trim() || undefined, lat: c[0], lon: c[1], podpis: r[5]?.trim() || undefined, haslo: r[6]?.trim() || undefined, aktywny: (r[7] ?? "").trim().toUpperCase() !== "NIE" });
  }
  const harmonogram = (await get("Harmonogram")).filter((r) => r[0] && r[2]).map((r) => ({ od: normDate(r[0]), do: normDate(r[1] || r[0]), id: r[2].trim() }));
  return { sponsorzy, harmonogram };
}

function fromRepo(): { sponsorzy: Sponsor[]; harmonogram: Wpis[] } {
  const p = path.join(root, "sponsorzy", "harmonogram.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : { sponsorzy: [], harmonogram: [] };
}

async function logo(s: Sponsor): Promise<string | undefined> {
  if (!s.logo) return undefined;
  if (!/^https?:/.test(s.logo)) return fs.existsSync(path.join(root, s.logo)) ? s.logo : undefined;
  const id = driveId(s.logo);
  const url = id ? `https://drive.google.com/uc?export=download&id=${id}` : s.logo;
  const r = await fetch(url);
  const ct = r.headers.get("content-type") ?? "";
  if (!r.ok || !ct.startsWith("image/")) {
    console.warn(`Logo sponsora niedostępne (${r.status} ${ct}) – czy plik jest udostępniony „każdy z linkiem”?`);
    return undefined;
  }
  const ext = ct.includes("svg") ? "svg" : ct.includes("jpeg") ? "jpg" : "png";
  const out = `data/sponsor-logo.${ext}`;
  fs.writeFileSync(path.join(root, out), Buffer.from(await r.arrayBuffer()));
  return out;
}

export async function pickSponsor(date = DATE): Promise<Sponsor | null> {
  let src;
  const sheet = process.env.SPONSOR_SHEET_ID;
  if (sheet) {
    try { src = await fromSheet(sheet); console.log("Sponsorzy: arkusz Google"); }
    catch (e) { console.warn((e as Error).message, "– używam public/sponsorzy/harmonogram.json"); }
  }
  src ??= fromRepo();
  const wpis = src.harmonogram.find((w) => w.od <= date && date <= w.do && src!.sponsorzy.some((s) => s.id === w.id && s.aktywny));
  if (!wpis) return null;
  const s = src.sponsorzy.find((x) => x.id === wpis.id)!;
  const local = ["png", "svg", "jpg"].map((e) => `sponsorzy/${s.id}.${e}`).find((f) => fs.existsSync(path.join(root, f)));
  return { ...s, logo: (await logo(s).catch(() => undefined)) ?? local };
}

if (process.argv[1]?.includes("sponsor")) {
  pickSponsor().then((s) => {
    fs.mkdirSync(path.join(root, "data"), { recursive: true });
    fs.writeFileSync(path.join(root, "data", "sponsor.json"), JSON.stringify(s, null, 2));
    console.log(s ? `Sponsor na ${DATE}: ${s.nazwa}` : `Na ${DATE} brak sponsora.`);
  }).catch((e) => { console.error(e); process.exit(1); });
}
