"use client";

/**
 * League logos from football-data.org crests CDN.
 * Only codes that reliably return emblems (no empty placeholders).
 * @see https://docs.football-data.org/general/v4/competition.html
 */
const LEAGUE_CRESTS: { code: string; name: string }[] = [
  { code: "PL", name: "Premier League" },
  { code: "PD", name: "La Liga" },
  { code: "BL1", name: "Bundesliga" },
  { code: "SA", name: "Serie A" },
  { code: "FL1", name: "Ligue 1" },
  { code: "ELC", name: "Championship" },
];

const CREST_BASE = "https://crests.football-data.org";

/** Only text hint: 1/X/2. Others are symbols (Predict, Score, Leaderboard already written below). */
const TEXT_HINT = { label: "1/X/2", angleDeg: -90 };
/** Symbol hints: angles for Predict, Score, Rank (platform hints as icons). */
const SYMBOL_HINTS: { type: "predict" | "score" | "rank"; angleDeg: number }[] = [
  { type: "predict", angleDeg: -30 },
  { type: "score", angleDeg: 90 },
  { type: "rank", angleDeg: 210 },
];

function buildRadii(step: number): number[] {
  const radii: number[] = [];
  for (let r = 3; r <= 50; r += step) radii.push(Math.min(r, 50));
  return radii;
}

const DESKTOP_RADII = buildRadii(0.7);
const MOBILE_RADII = buildRadii(1.05);

/** Stroke width and opacity: thick at center, nearly invisible at edge */
function circleStyle(r: number, firstRadius: number): { strokeWidth: number; opacity: number } {
  const t = (r - firstRadius) / (50 - firstRadius);
  const strokeWidth = Math.max(0.15, 2.2 - t * 2.1);
  const opacity = Math.max(0.04, 0.45 - t * 0.42);
  return { strokeWidth, opacity };
}

/** 6 league logos: angles -90 + i*60 */
const LOGO_ANGLES_DEG = [-90, -30, 30, 90, 150, 210];
const HINT_ANGLES_DEG = [-90, -30, 90, 210];
function starAnglesForCircle(circleIndex: number, count: number): number[] {
  const out: number[] = [];
  const avoid = new Set([...HINT_ANGLES_DEG, ...LOGO_ANGLES_DEG].map((a) => ((a % 360) + 360) % 360));
  for (let k = 0; k < count; k++) {
    let angle = (circleIndex * 137.5 + k * 97 + 17) % 360;
    if (angle < 0) angle += 360;
    const near = [...avoid].some((a) => Math.abs(((angle - a + 180) % 360) - 180) < 18);
    if (!near) out.push(angle);
    else out.push((angle + 25) % 360);
  }
  return out;
}

/** Round to 4 decimals so server and client produce identical style strings (avoids hydration mismatch). */
function pct(value: number): string {
  return `${Number(value.toFixed(4))}%`;
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" aria-hidden>
      <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" />
    </svg>
  );
}

/** Predict hint: crystal ball symbol */
function PredictIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="10" r="6" />
      <path d="M12 16v4M9 20h6" />
      <ellipse cx="12" cy="10" rx="2" ry="1.5" opacity="0.6" />
    </svg>
  );
}

/** Score hint: scoreboard (frame with colon) */
function ScoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}

/** Rank / leaderboard hint: trophy */
function RankIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 5h12v4a4 4 0 01-4 4h-4a4 4 0 01-4-4V5z" />
      <path d="M6 9H4a2 2 0 00-2 2v2a2 2 0 002 2h2M18 9h2a2 2 0 012 2v2a2 2 0 01-2 2h-2" />
      <path d="M12 9v10M8 19h8" />
      <path d="M10 19l2 2 2-2" />
    </svg>
  );
}

type LeagueLogosCircleProps = {
  variant?: "desktop" | "mobile";
};

export function LeagueLogosCircle({
  variant = "desktop",
}: LeagueLogosCircleProps) {
  const isMobile = variant === "mobile";
  const n = LEAGUE_CRESTS.length;
  const angleStep = (2 * Math.PI) / n;
  const logoRingR = isMobile ? 0.7 : 0.72;
  const radii = isMobile ? MOBILE_RADII : DESKTOP_RADII;
  const innerHintRadius = isMobile ? 22 / 50 : 24 / 50;

  return (
    <div
      className={`relative flex aspect-square w-full items-center justify-center ${
        isMobile
          ? "max-w-[17.5rem] min-h-[240px]"
          : "max-w-2xl min-h-[320px]"
      }`}
    >
      {/* Many concentric circles: infinite ripple, stroke thins toward edge */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <defs>
          <linearGradient id="innerCircleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(94,129,172)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="rgb(136,192,208)" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        {radii.map((r, i) => {
          const { strokeWidth, opacity } = circleStyle(r, radii[0]);
          const isInnermost = i === 0;
          return (
            <circle
              key={r}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={isInnermost ? "url(#innerCircleGrad)" : "currentColor"}
              strokeOpacity={isInnermost ? 0.5 : opacity}
              strokeWidth={isInnermost ? 2.2 : strokeWidth}
              className="text-nord-polarLighter"
            />
          );
        })}
      </svg>

      {/* Center: UEFA Champions League */}
      <div
        className={`relative z-10 flex items-center justify-center rounded-full bg-white/95 shadow-lg shadow-nord-polar/5 ring-1 ring-nord-polarLighter/10 ${
          isMobile ? "h-20 w-20" : "h-24 w-24 sm:h-28 sm:w-28"
        }`}
      >
        <img
          src={`${CREST_BASE}/CL.png`}
          alt="UEFA Champions League"
          className={`object-contain ${
            isMobile ? "h-12 w-12" : "h-14 w-14 sm:h-16 sm:w-16"
          }`}
          width={64}
          height={64}
          fetchPriority="high"
        />
      </div>

      {/* 1/X/2 text badge only */}
      {(() => {
        const h = TEXT_HINT;
        const rad = (h.angleDeg * Math.PI) / 180;
        const r = innerHintRadius;
        const x = 50 + 50 * r * Math.cos(rad);
        const y = 50 + 50 * r * Math.sin(rad);
        return (
          <div
            key="1x2"
            className={`absolute z-10 flex items-center justify-center rounded-full bg-white/90 px-1.5 py-0.5 font-semibold text-nord-frostDark shadow-sm ring-1 ring-nord-polarLighter/20 ${
              isMobile ? "min-w-[1.85rem] text-[9px]" : "min-w-[2rem] text-[10px] sm:text-xs"
            }`}
            style={{ left: pct(x), top: pct(y), transform: "translate(-50%, -50%)" }}
            aria-hidden
          >
            {h.label}
          </div>
        );
      })()}
      {/* Platform hint symbols (Predict, Score, Rank) – no text; design already has Predict • Score • Leaderboard below */}
      {SYMBOL_HINTS.map((h) => {
        const rad = (h.angleDeg * Math.PI) / 180;
        const r = innerHintRadius;
        const x = 50 + 50 * r * Math.cos(rad);
        const y = 50 + 50 * r * Math.sin(rad);
        const Icon = h.type === "predict" ? PredictIcon : h.type === "score" ? ScoreIcon : RankIcon;
        return (
          <div
            key={h.type}
            className={`absolute z-10 flex items-center justify-center rounded-full bg-white/90 text-nord-frostDark shadow-sm ring-1 ring-nord-polarLighter/20 ${
              isMobile ? "h-7 w-7" : "h-8 w-8 sm:h-9 sm:w-9"
            }`}
            style={{ left: pct(x), top: pct(y), transform: "translate(-50%, -50%)" }}
            aria-hidden
          >
            <Icon className={isMobile ? "h-4 w-4" : "h-4 w-4 sm:h-5 sm:w-5"} />
          </div>
        );
      })}

      {/* Stars on each circle: more stars, clearly visible */}
      {radii.map((r, circleIndex) => {
        const count = isMobile
          ? r < 16
            ? 2
            : r < 32
              ? 2
              : 1
          : r < 12
            ? 3
            : r < 28
              ? 4
              : r < 42
                ? 3
                : 2;
        const angles = starAnglesForCircle(circleIndex, count);
        return angles.map((angleDeg, k) => {
          const rad = (angleDeg * Math.PI) / 180;
          const rNorm = r / 50;
          const x = 50 + 50 * rNorm * Math.cos(rad);
          const y = 50 + 50 * rNorm * Math.sin(rad);
          const opacityNum = isMobile
            ? r < 20
              ? 0.24
              : r < 38
                ? 0.16
                : 0.08
            : r < 18
              ? 0.4
              : r < 35
                ? 0.28
                : r < 45
                  ? 0.18
                  : 0.1;
          return (
            <div
              key={`star-${r}-${k}`}
              className={`absolute z-[5] flex items-center justify-center text-nord-frostDark ${
                isMobile ? "h-2.5 w-2.5" : "h-2.5 w-2.5 sm:h-3 sm:w-3"
              }`}
              style={{
                left: pct(x),
                top: pct(y),
                transform: "translate(-50%, -50%)",
                opacity: opacityNum.toFixed(2),
              }}
              aria-hidden
            >
              <StarIcon className="w-full h-full" />
            </div>
          );
        });
      })}

      {/* League logos: only show container when image loads; hide entire circle on error so no empty placeholders */}
      {LEAGUE_CRESTS.map((league, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        const x = 50 + 50 * logoRingR * Math.cos(angle);
        const y = 50 + 50 * logoRingR * Math.sin(angle);
        return (
          <div
            key={league.code}
            className={`absolute z-10 flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/95 shadow-md ring-1 ring-nord-polarLighter/15 league-logo-slot ${
              isMobile ? "h-9 w-9" : "h-10 w-10 sm:h-12 sm:w-12"
            }`}
            style={{
              left: pct(x),
              top: pct(y),
              transform: "translate(-50%, -50%)",
            }}
          >
            <img
              src={`${CREST_BASE}/${league.code}.png`}
              alt={league.name}
              className={`object-contain ${
                isMobile ? "h-5 w-5" : "h-6 w-6 sm:h-7 sm:w-7"
              }`}
              width={28}
              height={28}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const el = e.currentTarget.closest(".league-logo-slot");
                if (el && el instanceof HTMLElement) el.style.display = "none";
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
