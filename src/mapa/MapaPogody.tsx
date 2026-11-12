/**
 * Scena mapy pogody (wersja 2): od pierwszej sekundy mapa 3D Podkarpacia.
 * POWITANIE (kamera powoli krąży, imieniny + słońce) → DZIEŃ → zbliżenie na opady/mgłę (dochodzą mniejsze miejscowości) → NOC.
 * Chmurki rozsuwają się, żeby nie nachodziły na siebie; najwyższa/najniższa temperatura zawsze na wierzchu.
 * Czas faz przychodzi z forecast.json (mapa.fazy) – dopasowany do zdań lektora.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, Img, interpolate, random, staticFile, useCurrentFrame, useDelayRender } from "remotion";
import * as maplibregl from "maplibre-gl";
import type { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildStyle } from "./style";
import { camAt, progress, type Cam, type Keyframe } from "./camera";
import { CITIES, COLORS, EXTRA_CITIES, FONT_FAMILY, LOGO, SAFE } from "../config";
import type { Forecast, WeatherKind } from "../types";
import { WeatherIcon, MoonIcon } from "../icons";

const W = 1080;
const H = 1920;
const abs = (p: string) => new URL(staticFile(p), window.location.href).href;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const temp = (t: number) => `${t < 0 ? "−" : ""}${Math.abs(t)}°`;
const MONTHS = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
const DAYS = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
const text: React.CSSProperties = { fontFamily: FONT_FAMILY, color: COLORS.white };

/** Kamera: całe województwo; zbliżenie na zjawisko */
const OVERVIEW: Cam = { lng: 22.3, lat: 49.8, zoom: 8.12, pitch: 42, bearing: -10 };

/* ---------- strzałka wiatru: wieje Z kierunku deg, więc grot pokazuje deg+180 ---------- */
const WindArrow: React.FC<{ deg: number; size: number; color?: string }> = ({ deg, size, color = COLORS.blue }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${deg + 180}deg)` }}>
    <path d="M12 2 L18 12 H14 V22 H10 V12 H6 Z" fill={color} />
  </svg>
);

/* ---------- karta miasta ---------- */
const Card = React.forwardRef<HTMLDivElement, { name: string; kind: WeatherKind | "noc"; t: number; wind?: { deg: number; v: number }; hi?: "max" | "min"; dol?: boolean; small?: boolean }>(
  ({ name, kind, t, wind, hi, dol, small }, ref) => {
    const col = hi === "max" ? "#FF9F43" : hi === "min" ? COLORS.blue : small ? "rgba(140,200,255,0.35)" : "rgba(255,255,255,0.18)";
    const k = hi ? 1.25 : small ? 0.85 : 1;
    return (
      <div ref={ref} style={{ position: "absolute", left: 0, top: 0, opacity: 0, willChange: "transform, opacity" }}>
        <div data-in="1" style={{ position: "absolute", transform: dol ? "translate(-50%, 0)" : "translate(-50%, -100%)", display: "flex", flexDirection: dol ? "column-reverse" : "column", alignItems: "center" }}>
          <div data-bub="1" style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(6,12,26,0.84)", border: `${hi ? 3 : 1.5}px solid ${col}`, borderRadius: 16 * k, padding: `${4 * k}px ${12 * k}px ${4 * k}px ${4 * k}px`, boxShadow: hi ? `0 0 26px ${col}` : "0 4px 14px rgba(0,0,0,0.5)" }}>
            {kind === "noc" ? <div style={{ width: 52 * k, display: "flex", justifyContent: "center" }}><MoonIcon size={40 * k} /></div> : <WeatherIcon kind={kind} size={52 * k} />}
            <div style={{ lineHeight: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ ...text, fontWeight: 900, fontSize: 38 * k, letterSpacing: -1, color: hi ? col : COLORS.white, whiteSpace: "nowrap" }}>{temp(t)}</span>
                {wind && wind.v >= 1 ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <WindArrow deg={wind.deg} size={20 * k} />
                    <span style={{ ...text, fontWeight: 700, fontSize: 15 * k, color: COLORS.blue }}>{wind.v}</span>
                  </span>
                ) : null}
              </div>
              <div style={{ ...text, fontWeight: 700, fontSize: 15 * k, color: COLORS.muted, whiteSpace: "nowrap", marginTop: 2 }}>{name}</div>
            </div>
          </div>
          <div style={{ width: 2, height: 12, background: "rgba(255,255,255,0.6)" }} />
          <div data-dot="1" style={{ width: 9, height: 9, borderRadius: "50%", background: "#fff", transform: dol ? "translateY(-50%)" : "translateY(50%)" }} />
        </div>
      </div>
    );
  },
);
Card.displayName = "Card";

/* ---------- smugi wiatru nad mapą (kierunek przeważającego wiatru) ---------- */
const WindStreaks: React.FC<{ deg: number; v: number; opacity: number; frame: number }> = ({ deg, v, opacity, frame }) => {
  if (opacity <= 0.01 || v < 4) return null;
  const to = ((deg + 180) * Math.PI) / 180; // kierunek ruchu
  const dx = Math.sin(to), dy = -Math.cos(to);
  const speed = 4 + v * 0.35;
  return (
    <AbsoluteFill style={{ opacity: opacity * Math.min(1, v / 20) * 0.55, pointerEvents: "none" }}>
      {Array.from({ length: 46 }, (_, i) => {
        const L = 1500;
        const ph = (random(`w${i}`) * L + frame * speed) % L;
        const x = random(`wx${i}`) * W * 1.4 - W * 0.2 + dx * (ph - L / 2);
        const y = random(`wy${i}`) * H * 0.75 + H * 0.15 + dy * (ph - L / 2);
        const fade = Math.sin((ph / L) * Math.PI);
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: 70 + random(`wl${i}`) * 90, height: 2.5, borderRadius: 2, background: "linear-gradient(90deg, rgba(160,220,255,0), rgba(200,235,255,0.9))", transform: `rotate(${(to * 180) / Math.PI - 90}deg)`, opacity: fade }} />;
      })}
    </AbsoluteFill>
  );
};

/* ---------- opady / mgła w środku kadru ---------- */
const Zjawisko: React.FC<{ kind: WeatherKind; frame: number; opacity: number }> = ({ kind, frame, opacity }) => {
  if (opacity <= 0.01) return null;
  const fog = kind === "mgla";
  const snow = kind === "snieg" || kind === "zamiec";
  const n = fog ? 14 : 200;
  return (
    <AbsoluteFill style={{ opacity, overflow: "hidden", pointerEvents: "none", maskImage: "radial-gradient(ellipse at 50% 50%, #000 40%, transparent 78%)", WebkitMaskImage: "radial-gradient(ellipse at 50% 50%, #000 40%, transparent 78%)" }}>
      {Array.from({ length: n }, (_, i) => {
        const rx = random(`x${i}`), ry = random(`y${i}`), rs = random(`s${i}`);
        if (fog) {
          const x = ((rx * W * 1.6 + frame * (0.6 + rs)) % (W * 1.6)) - W * 0.3;
          return <div key={i} style={{ position: "absolute", left: x, top: H * (0.3 + ry * 0.45), width: W * 0.7, height: H * 0.09, borderRadius: "50%", background: "rgba(220,230,245,.24)", filter: `blur(${30 + rs * 30}px)` }} />;
        }
        const speed = snow ? 2.2 + rs * 2.6 : 20 + rs * 14;
        const y = (ry * H + frame * speed) % H;
        const x = (rx * W + (snow ? Math.sin((frame + i * 13) / 18) * 18 : -frame * 3)) % W;
        return snow ? (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: 4 + rs * 8, height: 4 + rs * 8, borderRadius: "50%", background: "#fff", opacity: 0.55 + rs * 0.45 }} />
        ) : (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: 2, height: 24 + rs * 26, background: "linear-gradient(rgba(140,200,255,0), rgba(170,215,255,.9))", transform: "rotate(12deg)" }} />
        );
      })}
      {kind === "burza" && frame % 47 < 3 ? <AbsoluteFill style={{ background: "#fff", opacity: 0.35 }} /> : null}
    </AbsoluteFill>
  );
};

/* ---------- rozsuwanie chmurek: każda dostaje miejsce bez nakładania; ważniejsze pierwsze ---------- */
type Rect = { x0: number; y0: number; x1: number; y1: number };
type Place = { below: boolean; dx: number };
const hit = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const STEM = 17;
const rectOf = (x: number, y: number, w: number, h: number, pl: Place): Rect => {
  const x0 = x - w / 2 + pl.dx;
  return pl.below ? { x0, y0: y, x1: x0 + w, y1: y + h + STEM } : { x0, y0: y - h - STEM, x1: x0 + w, y1: y };
};
type Item = { key: string; x: number; y: number; prio: number; dol: boolean; el: HTMLDivElement; on: boolean };
const layout = (items: Item[], last: Map<string, Place>, top: number, bottom: number, obst: Rect[] = []): Map<string, Place | null> => {
  const res = new Map<string, Place | null>();
  const placed: Rect[] = [...obst];
  // kropki miejscowości też są przeszkodą (chmurka nie zasłania innej miejscowości)
  const dots: Rect[] = items.filter((i) => i.on).map((i) => ({ x0: i.x - 8, y0: i.y - 8, x1: i.x + 8, y1: i.y + 8 }));
  for (const it of [...items].sort((a, b) => b.prio - a.prio)) {
    if (!it.on) { res.set(it.key, null); continue; }
    const bub = it.el.querySelector("[data-bub]") as HTMLElement;
    const w = bub.offsetWidth, h = bub.offsetHeight;
    const prev = last.get(it.key);
    const s = Math.round(w * 0.38);
    const base: Place[] = [
      { below: it.dol, dx: 0 }, { below: !it.dol, dx: 0 },
      { below: it.dol, dx: -s }, { below: it.dol, dx: s }, { below: !it.dol, dx: -s }, { below: !it.dol, dx: s },
    ];
    const cands = prev ? [prev, ...base] : base;
    let ok: Place | null = null;
    for (const pl of cands) {
      const r = rectOf(it.x, it.y, w, h, pl);
      if (r.y0 < top || r.y1 > bottom || r.x0 < 8 || r.x1 > W - 8) continue;
      if (placed.some((q) => hit(q, r))) continue;
      if (dots.some((d) => hit(d, r) && !(d.x0 === it.x - 8 && d.y0 === it.y - 8))) continue;
      ok = pl; break;
    }
    if (!ok && it.prio >= 100) ok = cands[0]; // max / min zawsze widoczne (na wierzchu)
    if (ok) placed.push(rectOf(it.x, it.y, w, h, ok));
    res.set(it.key, ok);
  }
  return res;
};
const applyPlace = (el: HTMLDivElement, pl: Place) => {
  const inner = el.querySelector("[data-in]") as HTMLElement;
  const bub = el.querySelector("[data-bub]") as HTMLElement;
  const dot = el.querySelector("[data-dot]") as HTMLElement;
  inner.style.transform = pl.below ? "translate(-50%, 0)" : "translate(-50%, -100%)";
  inner.style.flexDirection = pl.below ? "column-reverse" : "column";
  dot.style.transform = pl.below ? "translateY(-50%)" : "translateY(50%)";
  bub.style.transform = `translateX(${pl.dx}px)`;
};

/* ---------- znacznik sponsora: przez całą prognozę ---------- */
const SPW = 150, SPH = 112;
const SponsorPin = React.forwardRef<HTMLDivElement, { s: NonNullable<Forecast["sponsor"]>; o: number }>(({ s, o }, ref) => (
  <div ref={ref} style={{ position: "absolute", left: 0, top: 0, zIndex: 20, opacity: o }}>
    <div style={{ position: "absolute", transform: "translate(-50%, -100%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: SPW, background: "rgba(255,255,255,0.96)", borderRadius: 18, padding: "8px 10px 6px", boxShadow: "0 0 0 3px #FFD23F, 0 8px 26px rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        {s.logo ? <Img src={staticFile(s.logo)} style={{ width: SPW - 24, height: 58, objectFit: "contain" }} /> : <div style={{ ...text, color: "#111", fontWeight: 900, fontSize: 22, textAlign: "center", lineHeight: 1.05 }}>{s.nazwa}</div>}
        <div style={{ ...text, color: "#333", fontWeight: 800, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>Sponsor pogody</div>
      </div>
      <div style={{ width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "14px solid #FFD23F" }} />
      <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#FFD23F", border: "3px solid #fff", transform: "translateY(-2px)" }} />
    </div>
  </div>
));
SponsorPin.displayName = "SponsorPin";

/* ---------- kompas: obraca się razem z mapą ---------- */
const Kompas: React.FC<{ bearing: number; o: number }> = ({ bearing, o }) => {
  const R = 46;
  const lab = [["N", 0, "#FFFFFF"], ["E", 90, "rgba(255,255,255,0.8)"], ["S", 180, "rgba(255,255,255,0.8)"], ["W", 270, "rgba(255,255,255,0.8)"]] as const;
  return (
    <div style={{ position: "absolute", left: SAFE.side - 14, bottom: SAFE.bottom + 34, width: 2 * R + 40, height: 2 * R + 40, opacity: o }}>
      <svg width={2 * R + 40} height={2 * R + 40} viewBox={`${-R - 20} ${-R - 20} ${2 * R + 40} ${2 * R + 40}`}>
        <circle r={R} fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.85)" strokeWidth={2.5} />
        <g transform={`rotate(${-bearing})`}>
          {Array.from({ length: 16 }, (_, i) => <line key={i} x1={0} y1={-R + 4} x2={0} y2={-R + (i % 4 ? 9 : 14)} stroke="rgba(255,255,255,0.5)" strokeWidth={2} transform={`rotate(${i * 22.5})`} />)}
          <path d={`M0 ${-R + 16} L8 0 L0 5 L-8 0 Z`} fill="#FFFFFF" />
          <path d={`M0 ${R - 16} L8 0 L0 -5 L-8 0 Z`} fill="rgba(255,255,255,0.35)" />
          {lab.map(([t, deg, col]) => {
            const r = ((deg as number) * Math.PI) / 180;
            return <text key={t} x={Math.sin(r) * (R + 2)} y={-Math.cos(r) * (R + 2)} transform={`rotate(${bearing} ${Math.sin(r) * (R + 2)} ${-Math.cos(r) * (R + 2)})`} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: FONT_FAMILY, fontWeight: 900, fontSize: 19, fill: col, paintOrder: "stroke", stroke: "#060b16", strokeWidth: 5 }}>{t}</text>;
          })}
        </g>
      </svg>
    </div>
  );
};

export const MapaPogody: React.FC<{ f: Forecast; dur: number; introFr: number }> = ({ f, dur, introFr }) => {
  const frame = useCurrentFrame();
  const { delayRender, continueRender } = useDelayRender();
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Map<string, HTMLDivElement>>(new Map());
  const spRef = useRef<HTMLDivElement>(null);
  const sp = f.sponsor ?? null;
  const layoutCache = useRef<Map<number, Map<string, { pl: Place | null; below?: boolean }>>>(new Map());
  const [map, setMap] = useState<MlMap | null>(null);
  const [handle] = useState(() => delayRender("Mapa pogody"));
  const info = f.mapa!;
  const fz = info.fazy;
  const z = info.zjawisko;

  const cities = useMemo(
    () => f.cities.map((c) => ({ ...c, cfg: CITIES.find((x) => x.name === c.name) })).filter((c) => c.cfg),
    [f.cities],
  );
  const extras = useMemo(
    () => (f.extra ?? []).map((c) => ({ ...c, cfg: EXTRA_CITIES.find((x) => x.name === c.name) })).filter((c) => c.cfg),
    [f.extra],
  );
  const maxD = Math.max(...cities.map((c) => c.tDay));
  const minN = Math.min(...cities.map((c) => c.tNight));

  /* ---------- oś czasu sceny ----------
   * 0..introFr: powitanie (mapa już widoczna, kamera krąży, imieniny + słońce)
   * introFr..dur: część pogodowa; fazy (ułamki) liczone względem tej części */
  const span = Math.max(1, dur - introFr);
  const fr = (x: number) => introFr + x * span;
  const T = (x: number) => fr(x) / Math.max(1, dur - 1); // ułamek całej sceny dla kamery
  const nightStart = fz.noc[0];
  const phases = (q: number) => ({
    dzien: progress(q, 6, 20) * (1 - progress(q, fr(nightStart) - 8, fr(nightStart) + 4)),
    noc: progress(q, fr(nightStart) + 4, fr(nightStart) + 20),
    fx: z ? progress(q, fr(fz.zjawisko![0]) + 10, fr(fz.zjawisko![0]) + 26) * (1 - progress(q, fr(fz.zjawisko![1]) - 14, fr(fz.zjawisko![1]))) : 0,
  });
  const { dzien, noc, fx } = phases(frame);
  const jasnosc = progress(frame, 0, 12) * (1 - progress(frame, fr(nightStart) - 6, fr(nightStart) + 14));
  const imieninyO = progress(frame, 8, 24) * (1 - progress(frame, z ? fr(fz.zjawisko![0]) - 6 : fr(nightStart) - 8, z ? fr(fz.zjawisko![0]) + 8 : fr(nightStart) + 4));
  const windO = progress(frame, introFr - 4, introFr + 12);
  const warnO = f.warnings.length ? progress(frame, fr(nightStart) + 30, fr(nightStart) + 46) : 0;
  const A: Cam = z ? { lng: z.lon, lat: z.lat + 0.03, zoom: 9.6, pitch: 56, bearing: -16 } : OVERVIEW;
  const START: Cam = { ...OVERVIEW, lng: OVERVIEW.lng - 0.15, zoom: OVERVIEW.zoom - 0.3, pitch: 30, bearing: -34 };
  const kfs: Keyframe[] = z
    ? [
        { t: 0, cam: START },
        { t: T(0) , cam: OVERVIEW },
        { t: T(fz.dzien[1] * 0.85), cam: { ...OVERVIEW, bearing: OVERVIEW.bearing + 4 } },
        { t: T(fz.zjawisko![0] + 0.06), cam: A },
        { t: T(fz.zjawisko![1] - 0.02), cam: { ...A, bearing: A.bearing + 8, zoom: A.zoom + 0.1 } },
        { t: Math.min(0.99, T(fz.noc[0] + 0.07)), cam: OVERVIEW },
        { t: 1, cam: { ...OVERVIEW, bearing: OVERVIEW.bearing - 4, zoom: OVERVIEW.zoom + 0.06 } },
      ]
    : [
        { t: 0, cam: START },
        { t: T(0), cam: OVERVIEW },
        { t: 1, cam: { ...OVERVIEW, bearing: OVERVIEW.bearing - 6, zoom: OVERVIEW.zoom + 0.08 } },
      ];
  const camOf = (q: number) => camAt(kfs, Math.min(1, Math.max(0, q / Math.max(1, dur - 1))));
  const cam = camOf(frame);

  /* ---------- mapa ---------- */
  useEffect(() => {
    if (!containerRef.current) return;
    const style = buildStyle(abs("mapa/manifest.json").replace(/manifest\.json$/, ""), { dem: true, demMaxZoom: 9, roads: false, water: true, s19: false });
    const m = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [cam.lng, cam.lat],
      zoom: cam.zoom,
      pitch: cam.pitch,
      bearing: cam.bearing,
      maxPitch: 85,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      pixelRatio: 1,
      canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
    });
    m.on("error", (e) => console.error("MapLibre:", e.error?.message ?? e));
    m.on("load", () => {
      for (const id of ["rail-czynna", "rail-czynna-podklady", "rail-budowa", "rail-planowana"]) m.setLayoutProperty(id, "visibility", "none");
      m.once("idle", () => {
        setMap(m);
        continueRender(handle);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map) return;
    const h = delayRender(`Mapa klatka ${frame}`);
    map.jumpTo({ center: [cam.lng, cam.lat], zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing });
    // „idle” czasem nie przychodzi (karta w tle, brak zmian) – zapas: po narysowaniu klatki i wczytaniu kafli
    let fired = false;
    const whenReady = (cb: () => void) => {
      const go = () => { if (!fired) { fired = true; cb(); } };
      map.once("idle", go);
      const check = () => { if (fired) return; if (map.areTilesLoaded()) go(); else setTimeout(check, 100); };
      map.once("render", () => setTimeout(check, 60));
      setTimeout(go, 20000);
    };
    whenReady(() => {
      /* Płynność: układ chmurek liczony deterministycznie co STEP klatek (dla kamery z tej klatki),
       * a między nimi chmurka przenika się (fade) i przesuwa – nic nie „wyskakuje” nagle,
       * a wynik nie zależy od kolejności renderowania klatek. */
      const STEP = 12;
      const top = SAFE.top + 250, bottom = H - SAFE.bottom - 150;
      const keys: { key: string; lon: number; lat: number; prio: number; dol: boolean; vis: (q: number) => number }[] = [];
      for (const night of [false, true]) {
        cities.forEach((c, i) => {
          const hi = night ? c.tNight === minN : c.tDay === maxD;
          keys.push({
            key: `${night ? "n" : "d"}${i}`, lon: c.cfg!.lon, lat: c.cfg!.lat, prio: hi ? 100 : 50 - i * 0.1, dol: "dol" in c.cfg! && !!c.cfg!.dol,
            vis: (q) => { const ph = phases(q); return Math.min(1, Math.max(0, (night ? ph.noc : ph.dzien) * cities.length - i * 0.55)); },
          });
        });
      }
      extras.forEach((c, i) => keys.push({ key: `x${i}`, lon: c.cfg!.lon, lat: c.cfg!.lat, prio: 10 - i * 0.1, dol: false, vis: (q) => phases(q).fx }));
      const tr0 = (map as unknown as { transform: { clone(): any } }).transform;
      const layoutAt = (q: number) => {
        const hitC = layoutCache.current.get(q);
        if (hitC) return hitC;
        const c = camOf(q);
        const tr = tr0.clone();
        tr.setCenter(new maplibregl.LngLat(c.lng, c.lat)); tr.setZoom(c.zoom); tr.setPitch(c.pitch); tr.setBearing(c.bearing);
        const out = new Map<string, { pl: Place | null }>();
        for (const night of [false, true]) {
          const items: Item[] = [];
          for (const k of keys) {
            if ((k.key[0] === "n") !== night) continue;
            const el = refs.current.get(k.key);
            if (!el) continue;
            const p = tr.locationToScreenPoint(new maplibregl.LngLat(k.lon, k.lat), map.terrain ?? undefined);
            const v = k.vis(q);
            items.push({ key: k.key, x: p.x, y: p.y, prio: k.prio, dol: k.dol, el, on: v > 0.01 && p.x > 0 && p.x < W && p.y > top && p.y < bottom });
          }
          const obst: Rect[] = [];
          if (sp) { const q = tr.locationToScreenPoint(new maplibregl.LngLat(sp.lon, sp.lat), map.terrain ?? undefined); obst.push({ x0: q.x - SPW / 2 - 6, y0: q.y - SPH - 16, x1: q.x + SPW / 2 + 6, y1: q.y + 8 }); }
          for (const [kk, pl] of layout(items, new Map(), top, bottom, obst)) out.set(kk, { pl });
        }
        layoutCache.current.set(q, out);
        return out;
      };
      const q0 = Math.floor(frame / STEP) * STEP, q1 = q0 + STEP;
      const L0 = layoutAt(q0), L1 = layoutAt(q1);
      const a = (frame - q0) / STEP;
      const e = a * a * (3 - 2 * a);
      if (sp && spRef.current) {
        const q = map.project([sp.lon, sp.lat]);
        spRef.current.style.transform = `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px)`;
      }
      for (const k of keys) {
        const el = refs.current.get(k.key);
        if (!el) continue;
        const p = map.project([k.lon, k.lat]);
        el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        const p0 = L0.get(k.key)?.pl ?? null, p1 = L1.get(k.key)?.pl ?? null;
        const shown = (p0 ? 1 - e : 0) + (p1 ? e : 0);
        let pl: Place | null = p0 && p1 ? (p0.below === p1.below ? { below: p0.below, dx: p0.dx + (p1.dx - p0.dx) * e } : e < 0.5 ? p0 : p1) : p0 ?? p1;
        // przy zmianie strony (góra/dół) chmurka gaśnie i zapala się po drugiej stronie
        const flip = p0 && p1 && p0.below !== p1.below ? Math.abs(1 - 2 * e) : 1;
        if (pl) applyPlace(el, pl);
        el.style.zIndex = k.prio >= 100 ? "10" : "1";
        el.style.opacity = pl ? (k.vis(frame) * shown * flip).toFixed(3) : "0";
      }
      continueRender(h);
    });
    map.triggerRepaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, frame]);

  const d = new Date(`${f.date}T12:00:00Z`);
  const dateTxt = `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  const pill = (t: string, bg: string, fg: string, o: number) => (
    <div style={{ position: "absolute", top: SAFE.top + 135, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 16, opacity: o, transform: `translateY(${(1 - o) * -14}px)` }}>
      <div style={{ ...text, fontWeight: 900, fontSize: 40, letterSpacing: 3, background: bg, color: fg, padding: "4px 22px", borderRadius: 14 }}>{t}</div>
      <div style={{ ...text, fontWeight: 700, fontSize: 32, textShadow: "0 2px 12px #000" }}>{dateTxt}</div>
    </div>
  );
  // dolny pas: kompas z lewej, obok komunikaty (słońce/wiatr → zjawisko → ostrzeżenia IMGW)
  const SLOT_L = SAFE.side + 126;
  const bottomRow: React.CSSProperties = { position: "absolute", left: SLOT_L, right: SAFE.side, bottom: SAFE.bottom + 82, display: "flex", justifyContent: "flex-start", alignItems: "center", gap: 26, ...text, fontWeight: 800, fontSize: 32, textShadow: "0 2px 10px #000" };
  return (
    <AbsoluteFill style={{ background: "#060b16", overflow: "hidden" }}>
      <div ref={containerRef} style={{ position: "absolute", width: W, height: H }} />
      {/* noc / dzień */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #02061a, #030a24)", opacity: 0.55 * (1 - jasnosc), mixBlendMode: "multiply" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 70% 0%, rgba(255,190,110,.55), rgba(255,170,90,0) 60%)", opacity: 0.6 * jasnosc, mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 55%, rgba(2,5,12,.55) 100%)" }} />
      <WindStreaks deg={info.windDeg} v={info.windAvg} opacity={dzien} frame={frame} />
      {z ? <Zjawisko kind={z.kind} frame={frame} opacity={fx} /> : null}
      {/* karty */}
      <AbsoluteFill>
        {cities.map((c, i) => (
          <React.Fragment key={c.name}>
            <Card ref={(el) => { if (el) refs.current.set(`d${i}`, el); }} name={c.name} kind={c.kind} t={c.tDay} wind={{ deg: c.windDeg ?? info.windDeg, v: c.wind }} hi={c.tDay === maxD ? "max" : undefined} dol={"dol" in c.cfg! && c.cfg!.dol} />
            <Card ref={(el) => { if (el) refs.current.set(`n${i}`, el); }} name={c.name} kind="noc" t={c.tNight} hi={c.tNight === minN ? "min" : undefined} dol={"dol" in c.cfg! && c.cfg!.dol} />
          </React.Fragment>
        ))}
        {extras.map((c, i) => (
          <Card key={c.name} small ref={(el) => { if (el) refs.current.set(`x${i}`, el); }} name={c.name} kind={c.kind} t={c.tDay} />
        ))}
      </AbsoluteFill>
      {/* nagłówek */}
      <div style={{ position: "absolute", top: SAFE.top - 30, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Img src={staticFile(LOGO.file)} style={{ width: LOGO.width * 0.62, objectFit: "contain", filter: "drop-shadow(0 4px 18px rgba(0,0,0,0.6))", opacity: interpolate(frame, [0, 10], [0, 1], clamp) }} />
      </div>
      <Kompas bearing={cam.bearing} o={progress(frame, 4, 18)} />
      {pill("DZIEŃ", "#FFD23F", "#1A1200", dzien)}
      {pill("NOC", "#2C3F8F", "#E8EEFF", noc)}
      {/* imieniny (i święto) pod datą – znikają, gdy mapa zaczyna się zbliżać */}
      <div style={{ position: "absolute", top: SAFE.top + 200, left: SAFE.side, right: SAFE.side, textAlign: "center", opacity: imieninyO, transform: `translateY(${(1 - imieninyO) * -10}px)` }}>
        {f.dayNote ? <div style={{ ...text, fontWeight: 900, fontSize: 36, color: COLORS.magenta, textShadow: "0 2px 12px #000" }}>{f.dayNote}</div> : null}
        {f.imieniny?.length ? (
          <div style={{ ...text, fontWeight: 800, fontSize: 32, textShadow: "0 2px 12px #000" }}>
            <span style={{ color: COLORS.blue, fontWeight: 700 }}>Imieniny: </span>{f.imieniny.join(", ")}
          </div>
        ) : null}
      </div>
      {/* zjawisko – podpis */}
      {z ? (
        <div style={{ position: "absolute", left: SLOT_L, right: SAFE.side, bottom: SAFE.bottom + 52, display: "flex", alignItems: "center", gap: 14, background: "rgba(6,12,26,0.82)", border: "1px solid rgba(255,255,255,0.14)", borderLeft: `8px solid ${COLORS.blue}`, borderRadius: 18, padding: "14px 22px", opacity: fx, transform: `translateY(${(1 - fx) * 24}px)` }}>
          <WeatherIcon kind={z.kind} size={70} />
          <div style={{ ...text, fontWeight: 900, fontSize: 36, lineHeight: 1.1 }}>{z.text}</div>
        </div>
      ) : null}
      {/* dół: najpierw słońce, potem dochodzi wiatr */}
      <div style={{ ...bottomRow, opacity: progress(frame, 10, 26) * (1 - fx) * (1 - warnO) }}>
        <span><span style={{ color: "#FFC23D" }}>☀</span> {f.sunrise}</span>
        <span style={{ color: "#FFB48A" }}>↓ {f.sunset}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, opacity: windO * (1 - noc), width: windO * (1 - noc) > 0.01 ? undefined : 0, overflow: "hidden" }}>
          <span style={{ color: COLORS.muted }}>·</span>
          <WindArrow deg={info.windDeg} size={34} /> {info.windAvg} km/h
        </span>
      </div>
      {f.warnings.length ? (
        <div style={{ position: "absolute", left: SLOT_L, right: SAFE.side, bottom: SAFE.bottom + 52, display: "flex", flexDirection: "column", gap: 6, background: "rgba(6,12,26,0.82)", borderLeft: `8px solid ${COLORS.warn}`, borderRadius: 18, padding: "12px 20px", opacity: warnO, transform: `translateY(${(1 - warnO) * 20}px)` }}>
          <div style={{ ...text, fontWeight: 800, fontSize: 20, letterSpacing: 3, color: COLORS.warn }}>OSTRZEŻENIE IMGW</div>
          {f.warnings.slice(0, 2).map((w) => <div key={w.event} style={{ ...text, fontWeight: 800, fontSize: 30, lineHeight: 1.1 }}>{w.event}</div>)}
        </div>
      ) : null}
      {sp ? <SponsorPin ref={spRef} s={sp} o={progress(frame, 14, 30)} /> : null}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 28, textAlign: "center", ...text, fontWeight: 500, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
        Dane: MET Norway (CC BY 4.0) · mapa © OpenStreetMap contributors, AWS Terrain Tiles, GUGiK
      </div>
    </AbsoluteFill>
  );
};
