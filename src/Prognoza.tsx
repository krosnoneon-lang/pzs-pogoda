import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/fonts";
import {
  ALL_CARDS,
  BACKGROUNDS,
  COLORS,
  FONT_FAMILY,
  FPS,
  LOGO,
  MUSIC,
  PROJECT_CARDS,
  VOICEOVER,
  SAFE,
  TIMING,
  type EndCard,
} from "./config";
import type { CityForecast, Forecast } from "./types";
import { MoonIcon, WeatherIcon } from "./icons";

/* ---------- font lokalny (powtarzalny render, polskie znaki) ---------- */
const LATIN_EXT = "U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";
const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
for (const w of ["600", "700", "800", "900"]) {
  loadFont({ family: FONT_FAMILY, url: staticFile(`fonts/montserrat-latin-${w}-normal.woff2`), weight: w, unicodeRange: LATIN });
  loadFont({ family: FONT_FAMILY, url: staticFile(`fonts/montserrat-latin-ext-${w}-normal.woff2`), weight: w, unicodeRange: LATIN_EXT });
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const sec = (s: number) => Math.round(s * FPS);

/* ---------- oś czasu ---------- */
export const FORECAST_FRAMES = sec(TIMING.intro + 6 * TIMING.cityStagger + 0.6 + TIMING.hold);
export const MORNING_FRAMES = sec(TIMING.morning);
export const END_FRAMES = sec(TIMING.endCard);
const XF = sec(TIMING.crossfade);
export const MORNING_FROM = FORECAST_FRAMES - XF;
export const END_FROM = MORNING_FROM + MORNING_FRAMES - XF;
export const TOTAL_FRAMES = END_FROM + END_FRAMES;

/* ---------- formatowanie ---------- */
const temp = (t: number) => `${t < 0 ? "−" : ""}${Math.abs(t)}°`;
const DAYS = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
const MONTHS = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
const dateLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return { day: DAYS[d.getUTCDay()], date: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` };
};

const text: React.CSSProperties = { fontFamily: FONT_FAMILY, color: COLORS.white };

/* ---------- tło: wolny najazd, lekka winieta ---------- */
const Background: React.FC<{ file: string; blur?: number }> = ({ file, blur = 0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.07], clamp);
  return (
    <AbsoluteFill style={{ background: "#0A1222", overflow: "hidden" }}>
      <Img src={staticFile(file)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})`, filter: blur ? `blur(${blur}px)` : undefined }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(5,10,20,0.55) 0%, rgba(5,10,20,0.05) 22%, rgba(5,10,20,0.05) 75%, rgba(5,10,20,0.6) 100%)" }} />
    </AbsoluteFill>
  );
};

/* ---------- góra: logo + data ---------- */
const Header: React.FC<{ date: string }> = ({ date }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pLogo = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  const pDate = spring({ frame: frame - 12, fps, config: { damping: 200 } });
  const d = dateLabel(date);
  return (
    <div style={{ position: "absolute", top: SAFE.top - 30, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Img src={staticFile(LOGO.file)} style={{ width: LOGO.width, maxHeight: 170, objectFit: "contain", opacity: pLogo, transform: `translateY(${(1 - pLogo) * -20}px)`, filter: "drop-shadow(0 4px 18px rgba(0,0,0,0.5))" }} />
      <div style={{ marginTop: 18, textAlign: "center", opacity: pDate, transform: `translateY(${(1 - pDate) * 16}px)` }}>
        <div style={{ ...text, fontWeight: 800, fontSize: 30, letterSpacing: 8, color: COLORS.blue, textTransform: "uppercase" }}>Prognoza pogody · {d.day}</div>
        <div style={{ ...text, fontWeight: 900, fontSize: 68, letterSpacing: -1, lineHeight: 1.05, textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>{d.date}</div>
      </div>
    </div>
  );
};

/* ---------- środek: lista miast ---------- */
/** wiersze dopasowane do panelu wbudowanego w tła z Dysku: 6 × 150 px od y=620 */
const ROW_H = 150;
const PANEL_TOP = 620;

const DropIcon: React.FC = () => (
  <svg width={20} height={24} viewBox="0 0 20 24" style={{ verticalAlign: -3 }}>
    <path d="M10 1 C10 1 2 11 2 16 a8 8 0 0 0 16 0 C18 11 10 1 10 1 Z" fill={COLORS.blue} />
  </svg>
);
const WindIcon: React.FC = () => (
  <svg width={26} height={22} viewBox="0 0 26 22" style={{ verticalAlign: -3 }} fill="none" stroke={COLORS.blue} strokeWidth={2.6} strokeLinecap="round">
    <path d="M2 7 H16 a4 4 0 1 0 -4 -4" />
    <path d="M2 13 H21 a4 4 0 1 1 -4 4" />
  </svg>
);

const CityRow: React.FC<{ c: CityForecast; index: number }> = ({ c, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - sec(TIMING.intro + index * TIMING.cityStagger), fps, config: { damping: 22, stiffness: 140 } });
  const windTxt = c.gust >= 50 ? `${c.wind} km/h · porywy ${c.gust}` : `${c.wind} km/h ${c.windDir}`.trim();
  return (
    <div
      style={{
        height: ROW_H,
        display: "flex",
        alignItems: "center",
        padding: "0 70px 0 112px",
        opacity: interpolate(p, [0, 0.6], [0, 1], clamp),
        transform: `translateX(${interpolate(p, [0, 1], [-60, 0])}px)`,
      }}
    >
      <div style={{ width: 100, display: "flex", justifyContent: "center" }}>
        <WeatherIcon kind={c.kind} size={88} />
      </div>
      <div style={{ flex: 1, marginLeft: 22, minWidth: 0 }}>
        <div style={{ ...text, fontWeight: 800, fontSize: 50, lineHeight: 1.05, textShadow: "0 2px 10px rgba(0,0,0,0.45)" }}>{c.name}</div>
        <div style={{ ...text, fontWeight: 600, fontSize: 27, color: COLORS.muted, marginTop: 8, whiteSpace: "nowrap" }}>
          <DropIcon /> {c.pop}%&nbsp;&nbsp;&nbsp;
          {c.wind >= 0 && (
            <>
              <WindIcon /> {windTxt}
            </>
          )}
        </div>
      </div>
      <div style={{ width: 150, textAlign: "right", ...text, fontWeight: 900, fontSize: 70, letterSpacing: -2, textShadow: "0 2px 12px rgba(0,0,0,0.45)" }}>{temp(c.tDay)}</div>
      <div style={{ width: 130, textAlign: "right", ...text, fontWeight: 700, fontSize: 50, color: COLORS.blue, letterSpacing: -1 }}>{temp(c.tNight)}</div>
    </div>
  );
};

const CityPanel: React.FC<{ cities: CityForecast[] }> = ({ cities }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [sec(TIMING.intro) - 10, sec(TIMING.intro)], [0, 1], clamp);
  return (
    <>
      <div style={{ position: "absolute", top: PANEL_TOP - 34, left: 0, right: 0, display: "flex", justifyContent: "flex-end", padding: "0 70px", opacity: o, ...text, fontWeight: 800, fontSize: 22, letterSpacing: 4, color: COLORS.muted }}>
        <div style={{ width: 150, textAlign: "right" }}>DZIEŃ</div>
        <div style={{ width: 130, textAlign: "right", color: COLORS.blue }}>NOC</div>
      </div>
      <div style={{ position: "absolute", top: PANEL_TOP, left: 0, right: 0 }}>
        {cities.map((c, i) => (
          <CityRow key={c.name} c={c} index={i} />
        ))}
      </div>
    </>
  );
};

/* ---------- dół: słońce, pełnia, ostrzeżenia ---------- */
const BottomInfo: React.FC<{ f: Forecast }> = ({ f }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = sec(TIMING.intro + 6 * TIMING.cityStagger + 0.2);
  const p = spring({ frame: frame - start, fps, config: { damping: 200 } });
  const p2 = spring({ frame: frame - start - 8, fps, config: { damping: 200 } });
  const top = PANEL_TOP + ROW_H * 6 + 14;
  return (
    <div style={{ position: "absolute", top, left: SAFE.side, right: SAFE.side, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 26, opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
        <div style={{ ...text, fontWeight: 700, fontSize: 30 }}>
          <span style={{ color: "#FFC23D" }}>☀</span> wschód <b style={{ fontWeight: 900 }}>{f.sunrise}</b>
          <span style={{ color: COLORS.muted }}>&nbsp;·&nbsp;</span>zachód <b style={{ fontWeight: 900 }}>{f.sunset}</b>
        </div>
        {f.fullMoon && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 18px 6px 8px", borderRadius: 40, background: "rgba(255,255,255,0.14)", border: `1px solid ${COLORS.panelLine}` }}>
            <MoonIcon size={40} />
            <span style={{ ...text, fontWeight: 800, fontSize: 28 }}>Dziś pełnia</span>
          </div>
        )}
      </div>
      {!f.source.startsWith("DANE TESTOWE") && (
        <div style={{ order: 99, textAlign: "center", ...text, fontWeight: 600, fontSize: 17, color: "rgba(255,255,255,0.55)", opacity: p }}>{f.source}</div>
      )}
      {f.warnings.slice(0, 2).map((w, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "8px 20px",
            borderRadius: 20,
            background: "rgba(40,24,0,0.55)",
            border: `2px solid ${COLORS.warn}`,
            opacity: p2,
            transform: `translateY(${(1 - p2) * 14}px)`,
          }}
        >
          <div style={{ ...text, fontWeight: 900, fontSize: 34, color: COLORS.warn }}>⚠</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...text, fontWeight: 800, fontSize: 26, lineHeight: 1.15 }}>
              {w.event} <span style={{ color: COLORS.warn }}>· IMGW st. {w.level}</span>
            </div>
            <div style={{ ...text, fontWeight: 600, fontSize: 21, color: COLORS.muted, marginTop: 1 }}>{w.area}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ---------- plansza końcowa: sponsor albo projekt ---------- */
const EndCardView: React.FC<{ card: EndCard; bg: string }> = ({ card, bg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  const p2 = spring({ frame: frame - 14, fps, config: { damping: 200 } });
  const accent = card.accent === "magenta" ? COLORS.magenta : COLORS.blue;
  if (card.video) {
    const vf = sec(card.videoSeconds ?? 3);
    return (
      <AbsoluteFill style={{ background: "#050a1a" }}>
        <Sequence durationInFrames={vf} layout="absolute-fill">
          <OffthreadVideo src={staticFile(card.video)} volume={card.videoVolume ?? 0} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Sequence>
        {card.videoEndFrame && (
          <Sequence from={vf - 1} layout="absolute-fill">
            <Img src={staticFile(card.videoEndFrame)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </Sequence>
        )}
        {card.kicker && <div style={{ position: "absolute", top: SAFE.top + 90, left: 60, right: 60, textAlign: "center", ...text, fontWeight: 800, fontSize: 36, letterSpacing: 3, color: accent, textTransform: "uppercase", lineHeight: 1.3, whiteSpace: "nowrap", opacity: p, transform: `translateY(${(1 - p) * 14}px)`, textShadow: "0 2px 18px rgba(0,0,0,0.8)" }}>
          {card.kicker}
        </div>}
      </AbsoluteFill>
    );
  }
  if (card.image && card.imageFit === "contain") {
    return (
      <AbsoluteFill>
        <Background file={bg} blur={18} />
        <AbsoluteFill style={{ background: "rgba(4,6,16,0.78)" }} />
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ ...text, fontWeight: 800, fontSize: 34, letterSpacing: 5, color: accent, textTransform: "uppercase", textAlign: "center", opacity: p, padding: "0 60px" }}>{card.kicker}</div>
          <Img src={staticFile(card.image)} style={{ width: 1040, height: "auto", marginTop: 40, borderRadius: 24, opacity: p2, transform: `scale(${interpolate(p2, [0, 1], [0.95, 1])})`, boxShadow: `0 0 80px ${accent}55` }} />
          {card.subtitle && <div style={{ ...text, fontWeight: 600, fontSize: 38, color: COLORS.muted, textAlign: "center", marginTop: 40, opacity: p2 }}>{card.subtitle}</div>}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  if (card.image) {
    return (
      <AbsoluteFill>
        <Img src={staticFile(card.image)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <Background file={bg} blur={18} />
      <AbsoluteFill style={{ background: "rgba(6,10,22,0.62)" }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: `0 ${SAFE.side + 20}px` }}>
        <div style={{ ...text, fontWeight: 800, fontSize: 34, letterSpacing: 5, color: accent, textTransform: "uppercase", textAlign: "center", opacity: p }}>
          {card.kicker}
        </div>
        {card.logo ? (
          <Img src={staticFile(card.logo)} style={{ width: 720, height: "auto", marginTop: 40, opacity: p2, transform: `scale(${interpolate(p2, [0, 1], [0.94, 1])})` }} />
        ) : (
          <div style={{ ...text, fontWeight: 900, fontSize: 104, lineHeight: 1.02, textAlign: "center", marginTop: 24, letterSpacing: -2, opacity: p2, transform: `scale(${interpolate(p2, [0, 1], [0.94, 1])})`, textShadow: `0 0 40px ${accent}55` }}>
            {card.title}
          </div>
        )}
        {card.subtitle && (
          <div style={{ ...text, fontWeight: 600, fontSize: 38, color: COLORS.muted, textAlign: "center", marginTop: 28, opacity: p2 }}>{card.subtitle}</div>
        )}
        <div style={{ width: 120, height: 8, borderRadius: 4, background: accent, marginTop: 44, boxShadow: `0 0 24px ${accent}`, transform: `scaleX(${p2})` }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- plansza „Na dobry początek dnia” ---------- */
const MorningCard: React.FC<{ f: Forecast; bg: string }> = ({ f, bg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p1 = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  const p2 = spring({ frame: frame - (f.dayNote ? 22 : 8), fps, config: { damping: 200 } });
  const p3 = spring({ frame: frame - (f.dayNote ? 40 : 24), fps, config: { damping: 200 } });
  return (
    <AbsoluteFill>
      <Background file={bg} blur={14} />
      <AbsoluteFill style={{ background: "rgba(6,10,22,0.5)" }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: `0 ${SAFE.side + 16}px`, textAlign: "center" }}>
        <div style={{ ...text, fontWeight: 800, fontSize: 32, letterSpacing: 6, color: COLORS.blue, textTransform: "uppercase", opacity: p1 }}>
          Na dobry początek dnia
        </div>
        {f.dayNote && (
          <div style={{ marginTop: 56, opacity: p2, transform: `translateY(${(1 - p2) * 20}px)` }}>
            <div style={{ ...text, fontWeight: 700, fontSize: 36, color: COLORS.muted }}>Dziś obchodzimy</div>
            <div style={{ ...text, fontWeight: 900, fontSize: 70, lineHeight: 1.08, marginTop: 10, letterSpacing: -1 }}>{f.dayNote}</div>
          </div>
        )}
        <div style={{ width: 120, height: 6, borderRadius: 3, background: COLORS.magenta, margin: "60px 0", boxShadow: `0 0 20px ${COLORS.magenta}`, transform: `scaleX(${p3})` }} />
        <div style={{ opacity: p3, transform: `translateY(${(1 - p3) * 20}px)` }}>
          <div style={{ ...text, fontWeight: 800, fontSize: 30, letterSpacing: 4, color: COLORS.magenta, textTransform: "uppercase" }}>Myśl na dziś</div>
          <div style={{ ...text, fontWeight: 700, fontSize: 60, lineHeight: 1.2, marginTop: 22, fontStyle: "italic" }}>„{f.maxim}”</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- całość ---------- */
export const Prognoza: React.FC<Forecast> = (f) => {
  const frame = useCurrentFrame();
  const bg = BACKGROUNDS[f.background];
  const card = ALL_CARDS().find((c) => c.id === f.endCard) ?? PROJECT_CARDS[0];
  const fadeIn = (from: number) => interpolate(frame, [from, from + XF], [0, 1], clamp);
  const forecastOpacity = Math.min(interpolate(frame, [0, 10], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) }), 1 - fadeIn(MORNING_FROM));
  const musicLevel = f.voiceover ? VOICEOVER.musicUnderVoice : MUSIC.volume;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence durationInFrames={FORECAST_FRAMES} name="prognoza">
        <AbsoluteFill style={{ opacity: forecastOpacity }}>
          <Background file={bg} />
          <Header date={f.date} />
          <CityPanel cities={f.cities} />
          <BottomInfo f={f} />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={MORNING_FROM} durationInFrames={MORNING_FRAMES} name="na-dobry-poczatek">
        <AbsoluteFill style={{ opacity: Math.min(fadeIn(MORNING_FROM), 1 - fadeIn(END_FROM)) }}>
          <MorningCard f={f} bg={bg} />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={END_FROM} name="reklama">
        <AbsoluteFill style={{ opacity: fadeIn(END_FROM) }}>
          <EndCardView card={card} bg={bg} />
        </AbsoluteFill>
      </Sequence>
      {f.source.startsWith("DANE TESTOWE") && (
        <div style={{ position: "absolute", top: 110, left: 0, right: 0, textAlign: "center", ...text, fontWeight: 800, fontSize: 24, letterSpacing: 3, color: COLORS.warn }}>
          {f.source}
        </div>
      )}
      {MUSIC.enabled && (
        <Audio
          src={staticFile(MUSIC.file)}
          startFrom={sec(MUSIC.startAt)}
          volume={(fr) => musicLevel * interpolate(fr, [0, 8, TOTAL_FRAMES - sec(MUSIC.fadeOutSeconds), TOTAL_FRAMES], [0, 1, 1, 0], clamp)}
        />
      )}
      {f.voiceover && (
        <Sequence from={sec(VOICEOVER.startAt)} name="lektor">
          <Audio src={staticFile(VOICEOVER.file)} volume={VOICEOVER.volume} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
