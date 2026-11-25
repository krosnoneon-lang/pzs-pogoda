/**
 * PROGNOZA – WERSJA 2 (mapa).
 * 1) mapa Podkarpacia od pierwszej sekundy: powitanie (imieniny, słońce) → dzień → zbliżenie na opady/mgłę → noc
 * 2) plansza końcowa (logo / sponsor) nachodzi na koniec lektora
 * (myśl dnia wyłączona – miejsce na przyszłą reklamę)
 * Każda część trwa tyle, ile lektor mówi (osobne nagrania), ale nie krócej niż minimum.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { ALL_CARDS, BACKGROUNDS, COLORS, FONT_FAMILY, FPS, MAPA, MUSIC, PROJECT_CARDS, TIMING, VOICEOVER } from "./config";
import type { Forecast } from "./types";
import { EndCardView } from "./Prognoza";
import { MapaPogody } from "./mapa/MapaPogody";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const sec = (s: number) => Math.round(s * FPS);
const XF = sec(TIMING.crossfade);
const LEAD = 0.5; // lektor startuje pół sekundy po wejściu planszy
const TAIL = 0.6; // oddech po zdaniu

export const LEKTOR_FILES = { intro: "data/lektor-intro.mp3", mapa: "data/lektor-mapa.mp3" } as const;

const GAP = 0.25; // przerwa między powitaniem a pogodą

/** Jedna scena mapy: powitanie + pogoda (dwa nagrania jedno po drugim), potem plansza końcowa nachodzi na koniec lektora */
export const timeline2 = (f?: Partial<Forecast>) => {
  const s = f?.lektorSec ?? {};
  const INTRO_S = s.intro ? LEAD + s.intro + GAP : MAPA.intro;
  const hasKlip = f?.endCard === "sponsor" && !!f?.sponsor?.klip;
  const MAPA_S = s.mapa ? s.mapa + TAIL + (hasKlip ? 0.7 : 0) : MAPA.mapa; // z klipem: lektor kończy w całości przed klipem
  const MAP = sec(INTRO_S + MAPA_S);
  const INTRO_FR = sec(INTRO_S);
  const klip = f?.endCard === "sponsor" && f?.sponsor?.klip ? f.sponsor.klipSec ?? 3 : 0;
  const END = klip ? sec(klip) : Math.max(sec(TIMING.endCard), f?.ctaSec ? sec(VOICEOVER.ctaStartAt + f.ctaSec + 1.2) : 0);
  let END_FROM = MAP - XF;
  let endLen = END;
  // slajdy sponsora: wchodzą razem z pożegnaniem lektora, ostatni (z logo) trwa do końca + 1,5 s
  const pf = f?.mapa?.pozegnanieFaza;
  if (f?.endCard === "sponsor" && f?.sponsor?.slajdy?.length && s.mapa && pf != null) {
    END_FROM = INTRO_FR + sec(s.mapa * pf) - 6;
    const voiceEnd = INTRO_FR + sec(s.mapa);
    endLen = Math.max(sec(5.5), voiceEnd - END_FROM + sec(1.6));
  }
  // CTA nigdy nie wchodzi na lektora: startuje najwcześniej 0,4 s po końcu nagrania mapy
  const voiceEnd = s.mapa ? INTRO_FR + sec(s.mapa) : 0;
  const CTA_FROM = Math.max(END_FROM + sec(VOICEOVER.ctaStartAt), voiceEnd + sec(0.4));
  // sponsor z pożegnaniem (np. Folkowa Dolina) kończy lektorem sponsora – bez drugiego lektora (CTA PzS)
  const ctaOn = !!f?.cta && !(f?.endCard === "sponsor" && f?.sponsor?.pozegnanie);
  if (ctaOn && f?.ctaSec && !klip) endLen = Math.max(endLen, CTA_FROM + sec(f.ctaSec + 1.2) - END_FROM);
  return { MAP, INTRO_FR, END: endLen, END_FROM, CTA_FROM, ctaOn, TOTAL: END_FROM + endLen };
};

const text: React.CSSProperties = { fontFamily: FONT_FAMILY, color: COLORS.white };

/** zakończenie sponsora: szybkie zdjęcia pełnoekranowe (Ken Burns), ostatnie dłuższe z logo i hasłem */
const SponsorSlajdy: React.FC<{ s: NonNullable<Forecast["sponsor"]>; dur: number }> = ({ s, dur }) => {
  const frame = useCurrentFrame();
  const imgs = s.slajdy!;
  const FAST = 26; // ~0,9 s na szybki slajd
  const lastFrom = FAST * (imgs.length - 1);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {imgs.map((src, i) => {
        const from = i * FAST;
        const to = i === imgs.length - 1 ? dur : from + FAST + 6;
        if (frame < from - 1 || frame > to) return null;
        const local = frame - from;
        const len = to - from;
        const o = Math.min(interpolate(local, [0, 6], [0, 1], clamp), i === imgs.length - 1 ? 1 : interpolate(local, [len - 6, len], [1, 0], clamp));
        const z = interpolate(local, [0, len], [1.12, 1.0], clamp);
        const dx = interpolate(local, [0, len], [i % 2 ? -30 : 30, 0], clamp);
        return (
          <AbsoluteFill key={src} style={{ opacity: o }}>
            <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z}) translateX(${dx}px)` }} />
          </AbsoluteFill>
        );
      })}
      {/* ostatni slajd: przyciemnienie od dołu, logo i hasło */}
      {(() => {
        const l = frame - lastFrom - 8;
        const o = interpolate(l, [0, 12], [0, 1], clamp);
        const sc = interpolate(l, [0, 14], [0.85, 1], clamp);
        return (
          <AbsoluteFill style={{ opacity: o }}>
            <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.78) 72%, rgba(0,0,0,0.9) 100%)" }} />
            <div style={{ position: "absolute", left: 80, right: 80, bottom: 420, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, transform: `scale(${sc})` }}>
              {s.logo ? <Img src={staticFile(s.logo)} style={{ width: 560, height: 420, objectFit: "contain", filter: "drop-shadow(0 8px 30px rgba(0,0,0,0.7))" }} /> : null}
              <div style={{ ...text, fontWeight: 800, fontSize: 26, letterSpacing: 6, color: "#FFD23F" }}>SPONSOR PROGNOZY POGODY</div>
              {s.haslo ? <div style={{ ...text, fontWeight: 900, fontSize: 46, textAlign: "center", lineHeight: 1.1, textShadow: "0 3px 16px #000" }}>{s.haslo}</div> : null}
            </div>
          </AbsoluteFill>
        );
      })()}
    </AbsoluteFill>
  );
};

export const PrognozaMapa: React.FC<Forecast> = (f) => {
  const frame = useCurrentFrame();
  const bg = BACKGROUNDS[f.background];
  const card =
    f.endCard === "sponsor" && f.sponsor
      ? { id: "sponsor", kicker: "Sponsor pogody", title: f.sponsor.nazwa, subtitle: f.sponsor.haslo ?? f.sponsor.podpis, logo: f.sponsor.logo, accent: "blue" as const }
      : ALL_CARDS().find((c) => c.id === f.endCard) ?? PROJECT_CARDS[0];
  const T = timeline2(f);
  const fadeIn = (from: number) => interpolate(frame, [from, from + XF], [0, 1], clamp);
  const s = f.lektorSec ?? {};
  const anyVoice = !!f.voiceover && !!(s.intro || s.mapa);
  const musicLevel = anyVoice ? VOICEOVER.musicUnderVoice : MUSIC.volume;
  const voice = (file: string, from: number) => (
    <Sequence from={from + sec(LEAD)} name={file}>
      <Audio src={staticFile(file)} volume={VOICEOVER.volume} />
    </Sequence>
  );
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence durationInFrames={T.MAP} name="mapa">
        <AbsoluteFill style={{ opacity: Math.min(interpolate(frame, [0, 8], [0, 1], clamp), 1 - fadeIn(T.END_FROM)) }}>
          {f.mapa ? <MapaPogody f={f} dur={T.MAP} introFr={T.INTRO_FR} /> : null}
        </AbsoluteFill>
      </Sequence>
      <Sequence from={T.END_FROM} name="plansza-koncowa">
        <AbsoluteFill style={{ opacity: fadeIn(T.END_FROM) }}>
          {f.endCard === "sponsor" && f.sponsor?.slajdy?.length ? (
            <SponsorSlajdy s={f.sponsor} dur={T.END} />
          ) : f.endCard === "sponsor" && f.sponsor?.klip ? (
            // klip sponsora (np. animowane logo) zamiast planszy końcowej
            <OffthreadVideo src={staticFile(f.sponsor.klip)} volume={0.9} />
          ) : (
            <EndCardView card={card} bg={bg} duck={T.ctaOn} />
          )}
        </AbsoluteFill>
      </Sequence>
      {f.source.startsWith("DANE TESTOWE") && (
        <div style={{ position: "absolute", top: 110, left: 0, right: 0, textAlign: "center", ...text, fontWeight: 800, fontSize: 24, letterSpacing: 3, color: COLORS.warn }}>{f.source}</div>
      )}
      {MUSIC.enabled && (
        <Audio
          src={staticFile(MUSIC.file)}
          loop
          startFrom={sec(MUSIC.startAt)}
          volume={(fr) => musicLevel * interpolate(fr, [0, 8, T.TOTAL - sec(MUSIC.fadeOutSeconds), T.TOTAL], [0, 1, 1, 0], clamp)}
        />
      )}
      {f.voiceover && s.intro ? voice(LEKTOR_FILES.intro, 0) : null}
      {f.voiceover && s.mapa ? voice(LEKTOR_FILES.mapa, T.INTRO_FR - sec(LEAD)) : null}
      {T.ctaOn && (
        <Sequence from={T.CTA_FROM} name="lektor-cta">
          <Audio src={staticFile(VOICEOVER.ctaFile)} volume={VOICEOVER.volume} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
