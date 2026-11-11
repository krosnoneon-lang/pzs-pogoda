/**
 * Scena mapy pogody (wersja 2): 17 miejscowości na mapie 3D Podkarpacia.
 * DZIEŃ (temperatury + strzałki wiatru) → zbliżenie na opady/mgłę → NOC.
 * Czas faz przychodzi z forecast.json (mapa.fazy) – dopasowany do zdań lektora.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, Img, interpolate, random, staticFile, useCurrentFrame, useDelayRender } from "remotion";
import * as maplibregl from "maplibre-gl";
import type { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildStyle } from "./style";
import { camAt, progress, type Cam, type Keyframe } from "./camera";
import { CITIES, COLORS, FONT_FAMILY, LOGO, SAFE } from "../config";
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
const Card = React.forwardRef<HTMLDivElement, { name: string; kind: WeatherKind | "noc"; t: number; wind?: { deg: number; v: number }; hi?: "max" | "min"; dol?: boolean }>(
  ({ name, kind, t, wind, hi, dol }, ref) => {
    const col = hi === "max" ? "#FF9F43" : hi === "min" ? COLORS.blue : "rgba(255,255,255,0.18)";
    const k = hi ? 1.25 : 1;
    return (
      <div ref={ref} style={{ position: "absolute", left: 0, top: 0, opacity: 0, willChange: "transform, opacity" }}>
        <div style={{ position: "absolute", transform: dol ? "translate(-50%, 0)" : "translate(-50%, -100%)", display: "flex", flexDirection: dol ? "column-reverse" : "column", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(6,12,26,0.84)", border: `${hi ? 3 : 1.5}px solid ${col}`, borderRadius: 16 * k, padding: `${4 * k}px ${12 * k}px ${4 * k}px ${4 * k}px`, boxShadow: hi ? `0 0 26px ${col}` : "0 4px 14px rgba(0,0,0,0.5)" }}>
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
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#fff", transform: dol ? "translateY(-50%)" : "translateY(50%)" }} />
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

export const MapaPogody: React.FC<{ f: Forecast; dur: number }> = ({ f, dur }) => {
  const frame = useCurrentFrame();
  const { delayRender, continueRender } = useDelayRender();
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [map, setMap] = useState<MlMap | null>(null);
  const [handle] = useState(() => delayRender("Mapa pogody"));
  const info = f.mapa!;
  const fz = info.fazy;
  const z = info.zjawisko;

  const cities = useMemo(
    () => f.cities.map((c) => ({ ...c, cfg: CITIES.find((x) => x.name === c.name) })).filter((c) => c.cfg),
    [f.cities],
  );
  const maxD = Math.max(...cities.map((c) => c.tDay));
  const minN = Math.min(...cities.map((c) => c.tNight));

  /* ---------- oś czasu sceny ---------- */
  const fr = (x: number) => x * dur;
  const dayEnd = z ? fz.zjawisko![0] : fz.noc[0];
  const nightStart = fz.noc[0];
  const dzien = progress(frame, fr(0.02), fr(0.08)) * (1 - progress(frame, fr(dayEnd) - 8, fr(dayEnd) + 4));
  const noc = progress(frame, fr(nightStart) + 4, fr(nightStart) + 20);
  const fx = z ? progress(frame, fr(fz.zjawisko![0]) + 10, fr(fz.zjawisko![0]) + 26) * (1 - progress(frame, fr(fz.zjawisko![1]) - 14, fr(fz.zjawisko![1]))) : 0;
  const jasnosc = progress(frame, 0, fr(0.08)) * (1 - progress(frame, fr(nightStart) - 6, fr(nightStart) + 14));
  const A: Cam = z ? { lng: z.lon, lat: z.lat + 0.03, zoom: 9.85, pitch: 58, bearing: -16 } : OVERVIEW;
  const kfs: Keyframe[] = z
    ? [
        { t: 0, cam: { ...OVERVIEW, zoom: OVERVIEW.zoom - 0.35, pitch: 28 } },
        { t: fz.dzien[1] * 0.85, cam: OVERVIEW },
        { t: fz.zjawisko![0] + 0.06, cam: A },
        { t: fz.zjawisko![1] - 0.02, cam: { ...A, bearing: A.bearing + 8, zoom: A.zoom + 0.1 } },
        { t: Math.min(0.99, fz.noc[0] + 0.07), cam: OVERVIEW },
        { t: 1, cam: { ...OVERVIEW, bearing: OVERVIEW.bearing - 4, zoom: OVERVIEW.zoom + 0.06 } },
      ]
    : [
        { t: 0, cam: { ...OVERVIEW, zoom: OVERVIEW.zoom - 0.35, pitch: 28 } },
        { t: 0.15, cam: OVERVIEW },
        { t: 1, cam: { ...OVERVIEW, bearing: OVERVIEW.bearing - 6, zoom: OVERVIEW.zoom + 0.08 } },
      ];
  const cam = camAt(kfs, frame / Math.max(1, dur - 1));

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
    map.once("idle", () => {
      cities.forEach((c, i) => {
        const p = map.project([c.cfg!.lon, c.cfg!.lat]);
        for (const night of [false, true]) {
          const el = refs.current.get(`${night ? "n" : "d"}${i}`);
          if (!el) continue;
          const phase = night ? noc : dzien;
          const stag = Math.min(1, Math.max(0, phase * cities.length - i * 0.55));
          // strefy Stories: góra (logo) i dół (pole odpowiedzi) zostają puste
          const safe = Math.min(1, Math.max(0, (p.y - (SAFE.top + 120)) / 40), Math.max(0, (H - SAFE.bottom - 60 - p.y) / 40));
          el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
          el.style.opacity = (stag * (1 - fx) * safe).toFixed(3);
        }
      });
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
      <div style={{ ...text, fontWeight: 700, fontSize: 30, textShadow: "0 2px 12px #000" }}>{dateTxt}</div>
    </div>
  );

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
      </AbsoluteFill>
      {/* nagłówek */}
      <div style={{ position: "absolute", top: SAFE.top - 30, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Img src={staticFile(LOGO.file)} style={{ width: LOGO.width * 0.62, objectFit: "contain", filter: "drop-shadow(0 4px 18px rgba(0,0,0,0.6))", opacity: interpolate(frame, [0, 10], [0, 1], clamp) }} />
      </div>
      {pill("DZIEŃ", "#FFD23F", "#1A1200", dzien * (1 - fx))}
      {pill("NOC", "#2C3F8F", "#E8EEFF", noc)}
      {/* zjawisko – podpis */}
      {z ? (
        <div style={{ position: "absolute", left: SAFE.side, right: SAFE.side, bottom: SAFE.bottom + 70, display: "flex", alignItems: "center", gap: 18, background: "rgba(6,12,26,0.82)", border: "1px solid rgba(255,255,255,0.14)", borderLeft: `8px solid ${COLORS.blue}`, borderRadius: 18, padding: "14px 22px", opacity: fx, transform: `translateY(${(1 - fx) * 24}px)` }}>
          <WeatherIcon kind={z.kind} size={84} />
          <div style={{ ...text, fontWeight: 900, fontSize: 44, lineHeight: 1.1 }}>{z.text}</div>
        </div>
      ) : null}
      {/* wiatr – legenda */}
      <div style={{ position: "absolute", left: SAFE.side, bottom: SAFE.bottom + 70, display: "flex", alignItems: "center", gap: 10, opacity: dzien * (1 - fx), ...text, fontWeight: 700, fontSize: 26, textShadow: "0 2px 10px #000" }}>
        <WindArrow deg={info.windDeg} size={34} /> wiatr {info.windAvg} km/h
      </div>
      {/* wschód / zachód w nocy */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: SAFE.bottom + 70, display: "flex", justifyContent: "center", gap: 30, opacity: noc, ...text, fontWeight: 800, fontSize: 32, textShadow: "0 2px 10px #000" }}>
        <span><span style={{ color: "#FFC23D" }}>☀</span> wschód {f.sunrise}</span>
        <span style={{ color: COLORS.muted }}>·</span>
        <span>zachód {f.sunset}</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: SAFE.bottom + 30, textAlign: "center", ...text, fontWeight: 600, fontSize: 15, color: "rgba(255,255,255,0.55)" }}>
        Dane: MET Norway (CC BY 4.0) · mapa © OpenStreetMap contributors, AWS Terrain Tiles, GUGiK
      </div>
    </AbsoluteFill>
  );
};
