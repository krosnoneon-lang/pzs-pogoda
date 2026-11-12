/**
 * PROGNOZA – WERSJA 2 (mapa).
 * 1) mapa Podkarpacia od pierwszej sekundy: powitanie (imieniny, słońce) → dzień → zbliżenie na opady/mgłę → noc
 * 2) plansza końcowa (logo / sponsor) nachodzi na koniec lektora
 * (myśl dnia wyłączona – miejsce na przyszłą reklamę)
 * Każda część trwa tyle, ile lektor mówi (osobne nagrania), ale nie krócej niż minimum.
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
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
  const MAPA_S = s.mapa ? s.mapa + TAIL : MAPA.mapa;
  const MAP = sec(INTRO_S + MAPA_S);
  const INTRO_FR = sec(INTRO_S);
  const END = Math.max(sec(TIMING.endCard), f?.ctaSec ? sec(VOICEOVER.ctaStartAt + f.ctaSec + 1.2) : 0);
  const END_FROM = MAP - XF;
  return { MAP, INTRO_FR, END, END_FROM, TOTAL: END_FROM + END };
};

const text: React.CSSProperties = { fontFamily: FONT_FAMILY, color: COLORS.white };

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
          <EndCardView card={card} bg={bg} duck={!!f.cta} />
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
      {f.cta && (
        <Sequence from={T.END_FROM + sec(VOICEOVER.ctaStartAt)} name="lektor-cta">
          <Audio src={staticFile(VOICEOVER.ctaFile)} volume={VOICEOVER.volume} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
