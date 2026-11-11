/**
 * PROGNOZA – WERSJA 2 (mapa).
 * 1) plansza powitalna (tło pogodowe + logo + data): lektor – powitanie, imieniny, wschód/zachód słońca, święto
 * 2) mapa Podkarpacia: dzień → zbliżenie na opady/mgłę → noc, strzałki wiatru
 * 3) „Na dobry początek dnia” – myśl dnia
 * 4) plansza końcowa (logo / sponsor) + CTA
 * Każda część trwa tyle, ile lektor mówi (osobne nagrania), ale nie krócej niż minimum.
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ALL_CARDS, BACKGROUNDS, COLORS, FONT_FAMILY, FPS, MAPA, MUSIC, PROJECT_CARDS, SAFE, TIMING, VOICEOVER } from "./config";
import type { Forecast } from "./types";
import { Background, EndCardView, Header, MorningCard } from "./Prognoza";
import { MoonIcon } from "./icons";
import { MapaPogody } from "./mapa/MapaPogody";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const sec = (s: number) => Math.round(s * FPS);
const XF = sec(TIMING.crossfade);
const LEAD = 0.5; // lektor startuje pół sekundy po wejściu planszy
const TAIL = 0.6; // oddech po zdaniu

export const LEKTOR_FILES = { intro: "data/lektor-intro.mp3", mapa: "data/lektor-mapa.mp3", mysl: "data/lektor-mysl.mp3" } as const;

export const timeline2 = (f?: Partial<Forecast>) => {
  const s = f?.lektorSec ?? {};
  const INTRO = Math.max(sec(MAPA.intro), s.intro ? sec(LEAD + s.intro + TAIL) : 0);
  const MAP = Math.max(sec(MAPA.mapa), s.mapa ? sec(LEAD + s.mapa + TAIL) : 0);
  const MORNING = Math.max(sec(5.5), s.mysl ? sec(LEAD + s.mysl + TAIL + 0.4) : 0);
  const END = Math.max(sec(TIMING.endCard), f?.ctaSec ? sec(VOICEOVER.ctaStartAt + f.ctaSec + 1.2) : 0);
  const MAP_FROM = INTRO - XF;
  const MORNING_FROM = MAP_FROM + MAP - XF;
  const END_FROM = MORNING_FROM + MORNING - XF;
  return { INTRO, MAP, MORNING, END, MAP_FROM, MORNING_FROM, END_FROM, TOTAL: END_FROM + END };
};

const text: React.CSSProperties = { fontFamily: FONT_FAMILY, color: COLORS.white };

/* ---------- plansza powitalna ---------- */
const IntroCard: React.FC<{ f: Forecast; bg: string }> = ({ f, bg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = (d: number) => spring({ frame: frame - d, fps, config: { damping: 200 } });
  const row = (d: number): React.CSSProperties => ({ opacity: sp(d), transform: `translateY(${(1 - sp(d)) * 18}px)` });
  return (
    <AbsoluteFill>
      <Background file={bg} />
      <Header date={f.date} />
      <div style={{ position: "absolute", top: 700, left: SAFE.side, right: SAFE.side, display: "flex", flexDirection: "column", alignItems: "center", gap: 34, textAlign: "center" }}>
        {f.dayNote && (
          <div style={{ ...row(22), padding: "14px 30px", borderRadius: 24, background: "rgba(8,14,28,0.6)", border: `2px solid ${COLORS.magenta}`, boxShadow: `0 0 30px ${COLORS.magenta}55` }}>
            <div style={{ ...text, fontWeight: 800, fontSize: 26, letterSpacing: 5, color: COLORS.magenta, textTransform: "uppercase" }}>Dziś</div>
            <div style={{ ...text, fontWeight: 900, fontSize: 56, lineHeight: 1.08 }}>{f.dayNote}</div>
          </div>
        )}
        {f.imieniny?.length ? (
          <div style={row(f.dayNote ? 34 : 22)}>
            <div style={{ ...text, fontWeight: 800, fontSize: 28, letterSpacing: 5, color: COLORS.blue, textTransform: "uppercase" }}>Imieniny</div>
            <div style={{ ...text, fontWeight: 900, fontSize: 64, lineHeight: 1.1, textShadow: "0 3px 18px rgba(0,0,0,0.55)" }}>{f.imieniny.join(", ")}</div>
          </div>
        ) : null}
        <div style={{ ...row(f.dayNote ? 46 : 34), display: "flex", gap: 26, padding: "16px 30px", borderRadius: 24, background: "rgba(8,14,28,0.55)", border: `1px solid ${COLORS.panelLine}` }}>
          <div>
            <div style={{ ...text, fontWeight: 700, fontSize: 24, color: COLORS.muted }}>☀ wschód</div>
            <div style={{ ...text, fontWeight: 900, fontSize: 60 }}>{f.sunrise}</div>
          </div>
          <div style={{ width: 2, background: COLORS.panelLine }} />
          <div>
            <div style={{ ...text, fontWeight: 700, fontSize: 24, color: COLORS.muted }}>zachód</div>
            <div style={{ ...text, fontWeight: 900, fontSize: 60, color: "#FFB48A" }}>{f.sunset}</div>
          </div>
        </div>
        {f.fullMoon && (
          <div style={{ ...row(58), display: "flex", alignItems: "center", gap: 10, padding: "6px 18px 6px 8px", borderRadius: 40, background: "rgba(255,255,255,0.14)" }}>
            <MoonIcon size={40} />
            <span style={{ ...text, fontWeight: 800, fontSize: 28 }}>Dziś pełnia</span>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const PrognozaMapa: React.FC<Forecast> = (f) => {
  const frame = useCurrentFrame();
  const bg = BACKGROUNDS[f.background];
  const card = ALL_CARDS().find((c) => c.id === f.endCard) ?? PROJECT_CARDS[0];
  const T = timeline2(f);
  const fadeIn = (from: number) => interpolate(frame, [from, from + XF], [0, 1], clamp);
  const s = f.lektorSec ?? {};
  const anyVoice = !!f.voiceover && !!(s.intro || s.mapa || s.mysl);
  const musicLevel = anyVoice ? VOICEOVER.musicUnderVoice : MUSIC.volume;
  const voice = (file: string, from: number) => (
    <Sequence from={from + sec(LEAD)} name={file}>
      <Audio src={staticFile(file)} volume={VOICEOVER.volume} />
    </Sequence>
  );
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence durationInFrames={T.INTRO} name="powitanie">
        <AbsoluteFill style={{ opacity: Math.min(interpolate(frame, [0, 10], [0, 1], clamp), 1 - fadeIn(T.MAP_FROM)) }}>
          <IntroCard f={f} bg={bg} />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={T.MAP_FROM} durationInFrames={T.MAP} name="mapa" premountFor={sec(2)}>
        <AbsoluteFill style={{ opacity: Math.min(fadeIn(T.MAP_FROM), 1 - fadeIn(T.MORNING_FROM)) }}>
          {f.mapa ? <MapaPogody f={f} dur={T.MAP} /> : null}
        </AbsoluteFill>
      </Sequence>
      <Sequence from={T.MORNING_FROM} durationInFrames={T.MORNING} name="mysl-dnia">
        <AbsoluteFill style={{ opacity: Math.min(fadeIn(T.MORNING_FROM), 1 - fadeIn(T.END_FROM)) }}>
          <MorningCard f={{ ...f, dayNote: null }} bg={bg} />
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
      {f.voiceover && s.mapa ? voice(LEKTOR_FILES.mapa, T.MAP_FROM) : null}
      {f.voiceover && s.mysl ? voice(LEKTOR_FILES.mysl, T.MORNING_FROM) : null}
      {f.cta && (
        <Sequence from={T.END_FROM + sec(VOICEOVER.ctaStartAt)} name="lektor-cta">
          <Audio src={staticFile(VOICEOVER.ctaFile)} volume={VOICEOVER.volume} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
