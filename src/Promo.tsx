/**
 * Rolka promująca codzienną prognozę na Stories.
 * Żywa mapa 3D (dzisiejsze dane) z własną kamerą: przelot → zbliżenie na Bieszczady → przelot do sponsora → odjazd,
 * lektor promocyjny, napisy w stylu „lower third”, plansza końcowa.
 * Render: npx remotion render PromoPogoda out/promo.mp4 --props=promo.json --gl=swangle
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONT_FAMILY, FPS, PROJECT_CARDS, TIMING } from "./config";
import { EndCardView } from "./Prognoza";
import { MapaPogody, OVERVIEW, type PromoMode } from "./mapa/MapaPogody";
import type { Cam } from "./mapa/camera";
import type { Forecast } from "./types";

/** cuts: końce zdań 1–4 jako ułamek długości nagrania */
export type PromoProps = { f: Forecast; voiceSec: number; cuts: [number, number, number, number] };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const LEAD = 0.4;
const XF = 12;
export const promoTimeline = (p: Pick<PromoProps, "voiceSec">) => {
  const MAP = Math.round((LEAD + p.voiceSec + 0.5) * FPS);
  const END = Math.round(TIMING.endCard * FPS);
  return { MAP, END, TOTAL: MAP - XF + END };
};

const text: React.CSSProperties = { fontFamily: FONT_FAMILY, color: "#fff" };

const Lower: React.FC<{ from: number; to: number; kicker: string; head: React.ReactNode; accent: string }> = ({ from, to, kicker, head, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from - 2 || frame > to + 2) return null;
  const inP = spring({ frame: frame - from, fps, config: { damping: 18, stiffness: 140 } });
  const out = interpolate(frame, [to - 8, to], [0, 1], clamp);
  const bar = interpolate(frame, [from, from + 10], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: 72, right: 72, bottom: 360, opacity: Math.min(1, inP * 1.5) * (1 - out), transform: `translateX(${(1 - inP) * 120 - out * 80}px)` }}>
      <div style={{ display: "flex", alignItems: "stretch", gap: 22 }}>
        <div style={{ width: 10, borderRadius: 5, background: accent, boxShadow: `0 0 22px ${accent}`, transform: `scaleY(${bar})`, transformOrigin: "top" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ ...text, fontWeight: 800, fontSize: 30, letterSpacing: 6, color: accent, textShadow: "0 2px 14px rgba(0,0,0,0.9)" }}>{kicker}</div>
          <div style={{ ...text, fontWeight: 900, fontSize: 70, lineHeight: 1.02, textShadow: "0 4px 24px rgba(0,0,0,0.9)" }}>{head}</div>
        </div>
      </div>
    </div>
  );
};

const Chips: React.FC<{ from: number; to: number; items: [string, string][] }> = ({ from, to, items }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from - 2 || frame > to + 2) return null;
  const out = interpolate(frame, [to - 8, to], [0, 1], clamp);
  const step = Math.max(8, Math.round((to - from) / (items.length + 1)));
  return (
    <div style={{ position: "absolute", left: 72, right: 72, bottom: 360, display: "flex", flexDirection: "column", gap: 16, opacity: 1 - out }}>
      <div style={{ ...text, fontWeight: 800, fontSize: 30, letterSpacing: 6, color: COLORS.muted, textShadow: "0 2px 14px #000", opacity: interpolate(frame, [from, from + 8], [0, 1], clamp) }}>W KAŻDEJ PROGNOZIE</div>
      {items.map(([t, col], i) => {
        const p = spring({ frame: frame - from - i * step, fps, config: { damping: 16, stiffness: 160 } });
        return (
          <div key={t} style={{ display: "flex", opacity: Math.min(1, p * 1.4), transform: `translateX(${(1 - p) * 140}px)` }}>
            <div style={{ ...text, fontWeight: 900, fontSize: 54, background: "rgba(6,12,26,0.88)", border: `2px solid ${col}`, borderRadius: 18, padding: "6px 24px", boxShadow: `0 0 26px ${col}55` }}>{t}</div>
          </div>
        );
      })}
    </div>
  );
};

export const PromoPogoda: React.FC<PromoProps> = (p) => {
  const frame = useCurrentFrame();
  const T = promoTimeline(p);
  const lead = Math.round(LEAD * FPS);
  const at = (x: number) => lead + Math.round(x * p.voiceSec * FPS);
  const [c1, c2, c3, c4] = p.cuts;
  const t = (fr: number) => Math.min(1, Math.max(0, fr / (T.MAP - 1)));

  const f = p.f;
  const sp = f.sponsor;
  const BIESZ: Cam = { lng: 22.42, lat: 49.27, zoom: 9.25, pitch: 60, bearing: -24 };
  const SPON: Cam = sp ? { lng: sp.lon, lat: sp.lat - 0.02, zoom: 10.7, pitch: 58, bearing: 14 } : OVERVIEW;
  const START: Cam = { ...OVERVIEW, zoom: OVERVIEW.zoom - 0.55, pitch: 18, bearing: -48, lat: OVERVIEW.lat - 0.25 };
  const promo: PromoMode = {
    kfs: [
      { t: 0, cam: START },
      { t: t(at(c1 * 0.75)), cam: { ...OVERVIEW, bearing: OVERVIEW.bearing - 6 } },
      { t: t(at(c1 + 0.04)), cam: BIESZ },
      { t: t(at(c2 - 0.02)), cam: { ...BIESZ, bearing: BIESZ.bearing + 14, zoom: BIESZ.zoom + 0.2 } },
      { t: t(at(c2 + 0.07)), cam: SPON },
      { t: t(at(c3 + 0.02)), cam: { ...SPON, bearing: SPON.bearing - 10, zoom: SPON.zoom + 0.15 } },
      { t: t(at(c3 + 0.12)), cam: { ...OVERVIEW, pitch: OVERVIEW.pitch + 6 } },
      { t: 1, cam: { ...OVERVIEW, bearing: OVERVIEW.bearing + 10, zoom: OVERVIEW.zoom + 0.08 } },
    ],
    fx: (q) =>
      Math.max(
        interpolate(q, [at(c1 + 0.02), at(c1 + 0.06), at(c2 - 0.01), at(c2 + 0.03)], [0, 1, 1, 0], clamp),
        interpolate(q, [at(c2 + 0.05), at(c2 + 0.08), at(c3 + 0.02), at(c3 + 0.07)], [0, 1, 1, 0], clamp),
      ),
    pinBoost: (q) => interpolate(q, [at(c2 + 0.04), at(c2 + 0.08), at(c3 + 0.03), at(c3 + 0.08)], [0, 1, 1, 0], clamp),
  };
  const fMap: Forecast = { ...f, mapa: f.mapa ? { ...f.mapa, zjawisko: null } : f.mapa, warnings: [] };

  return (
    <AbsoluteFill style={{ background: "#060b16" }}>
      <Sequence durationInFrames={T.MAP} name="mapa">
        <AbsoluteFill style={{ opacity: Math.min(interpolate(frame, [0, 8], [0, 1], clamp), interpolate(frame, [T.MAP - XF, T.MAP], [1, 0], clamp)) }}>
          <MapaPogody f={fMap} dur={T.MAP} introFr={0} promo={promo} />
        </AbsoluteFill>
        <Lower from={at(0) + 4} to={at(c1)} accent="#FFD23F" kicker="CODZIENNIE O 6:00" head={<>Prognoza pogody<br />na naszych Stories</>} />
        <Chips from={at(c1) + 6} to={at(c2)} items={[["Imieniny", COLORS.magenta], ["Temperatura", "#FF9F43"], ["Warunki za oknem", COLORS.blue]]} />
        <Lower from={at(c2) + 6} to={at(c3)} accent="#FFD23F" kicker="OGLĄDACIE DZIĘKI" head={<>naszym<br /><span style={{ color: "#FFD23F" }}>sponsorom</span></>} />
        <Lower from={at(c3) + 4} to={at(c4)} accent={COLORS.blue} kicker="PODKARPACIE ZE SMAKIEM" head={<>Polub<br />i obserwuj</>} />
        <Lower from={at(c4) + 4} to={T.MAP - 2} accent={COLORS.magenta} kicker="PODOBA SIĘ?" head={<>Wyślij<br />znajomym</>} />
      </Sequence>
      <Sequence from={T.MAP - XF} durationInFrames={T.END} name="koniec">
        <EndCardView card={PROJECT_CARDS[0]} bg="" />
      </Sequence>
      <Sequence from={lead}>
        <Audio src={staticFile("data/promo-lektor.mp3")} />
      </Sequence>
      <Audio src={staticFile("muzyka/skyline-portfolio.wav")} volume={(fr) => interpolate(fr, [0, 15, T.TOTAL - 25, T.TOTAL], [0, 0.13, 0.13, 0], clamp)} />
    </AbsoluteFill>
  );
};
