import React from "react";
import type { WeatherKind } from "./types";

/** Własne, proste ikony SVG (bez zewnętrznych zasobów). viewBox 0 0 100 100. */
const SUN = "#FFC23D";
const CLOUD = "#F4F7FB";
const CLOUD_DARK = "#B9C3D3";
const RAIN = "#5CD6F6";
const ICE = "#BFF3FF";

const Sun: React.FC<{ cx?: number; cy?: number; r?: number }> = ({ cx = 50, cy = 50, r = 18 }) => (
  <g>
    {Array.from({ length: 8 }).map((_, i) => {
      const a = (i * Math.PI) / 4;
      return (
        <line key={i} x1={cx + Math.cos(a) * (r + 7)} y1={cy + Math.sin(a) * (r + 7)} x2={cx + Math.cos(a) * (r + 15)} y2={cy + Math.sin(a) * (r + 15)}
          stroke={SUN} strokeWidth={5} strokeLinecap="round" />
      );
    })}
    <circle cx={cx} cy={cy} r={r} fill={SUN} />
  </g>
);

const Cloud: React.FC<{ x?: number; y?: number; s?: number; fill?: string }> = ({ x = 0, y = 0, s = 1, fill = CLOUD }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} fill={fill}
    d="M28 72h46a16 16 0 0 0 1-32 22 22 0 0 0-42-6 15 15 0 0 0-5 38z" />
);

const Drops: React.FC<{ color?: string }> = ({ color = RAIN }) => (
  <g stroke={color} strokeWidth={5} strokeLinecap="round">
    <line x1={36} y1={80} x2={32} y2={92} />
    <line x1={52} y1={80} x2={48} y2={92} />
    <line x1={68} y1={80} x2={64} y2={92} />
  </g>
);

const Flake: React.FC<{ cx: number; cy: number; r?: number; color?: string }> = ({ cx, cy, r = 7, color = CLOUD }) => (
  <g stroke={color} strokeWidth={3.2} strokeLinecap="round">
    {[0, 60, 120].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return <line key={deg} x1={cx - Math.cos(a) * r} y1={cy - Math.sin(a) * r} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} />;
    })}
  </g>
);

export const WeatherIcon: React.FC<{ kind: WeatherKind; size: number }> = ({ kind, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible", filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.35))" }}>
    {kind === "slonce" && <Sun />}
    {kind === "czesciowe" && (
      <>
        <Sun cx={38} cy={36} r={15} />
        <Cloud x={8} y={10} s={0.92} />
      </>
    )}
    {kind === "pochmurno" && (
      <>
        <Cloud x={-10} y={-8} s={0.8} fill={CLOUD_DARK} />
        <Cloud x={4} y={6} s={0.92} />
      </>
    )}
    {kind === "deszcz" && (
      <>
        <Cloud x={0} y={-8} />
        <Drops />
      </>
    )}
    {kind === "burza" && (
      <>
        <Cloud x={0} y={-10} fill={CLOUD_DARK} />
        <path d="M54 62 L40 82 H52 L44 98 L66 72 H54 L62 62 Z" fill={SUN} />
      </>
    )}
    {kind === "snieg" && (
      <>
        <Cloud x={0} y={-10} />
        <Flake cx={34} cy={86} />
        <Flake cx={52} cy={92} />
        <Flake cx={70} cy={86} />
      </>
    )}
    {kind === "mgla" && (
      <>
        <Cloud x={0} y={-14} fill={CLOUD_DARK} />
        <g stroke={CLOUD} strokeWidth={5} strokeLinecap="round">
          <line x1={18} y1={70} x2={82} y2={70} />
          <line x1={26} y1={81} x2={74} y2={81} />
          <line x1={18} y1={92} x2={70} y2={92} />
        </g>
      </>
    )}
    {kind === "gololedz" && (
      <>
        <Cloud x={0} y={-12} fill={CLOUD_DARK} />
        <Drops color={RAIN} />
        <rect x={20} y={95} width={60} height={5} rx={2.5} fill={ICE} />
        <Flake cx={80} cy={78} r={6} color={ICE} />
      </>
    )}
    {kind === "zamiec" && (
      <>
        <Cloud x={0} y={-12} />
        <g stroke={CLOUD} strokeWidth={4} strokeLinecap="round" fill="none">
          <path d="M12 74 H58 a7 7 0 1 0 -7 -7" />
          <path d="M16 86 H72 a7 7 0 1 1 -7 7" />
        </g>
        <Flake cx={78} cy={70} r={6} />
        <Flake cx={30} cy={96} r={5} />
      </>
    )}
  </svg>
);

export const MoonIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <defs>
      <radialGradient id="moon" cx="40%" cy="38%" r="65%">
        <stop offset="0%" stopColor="#FFFDF2" />
        <stop offset="100%" stopColor="#E8E1C8" />
      </radialGradient>
    </defs>
    <circle cx={50} cy={50} r={40} fill="url(#moon)" />
    <circle cx={38} cy={40} r={7} fill="#D9D1B4" opacity={0.7} />
    <circle cx={60} cy={60} r={9} fill="#D9D1B4" opacity={0.6} />
    <circle cx={62} cy={34} r={4} fill="#D9D1B4" opacity={0.6} />
  </svg>
);
