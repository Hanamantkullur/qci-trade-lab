// Finding good drill windows is the real work of running this platform.
//
// Twenty thousand bars is roughly two hundred hours of chart if you scroll it
// by hand. This scanner reads the dataset once and proposes windows that
// actually demonstrate something, classified by the lesson they teach, so the
// mentor's job drops to reviewing a shortlist instead of hunting.
//
// Every detector here is deliberately mechanical and explainable. None of it
// predicts anything — it is measuring what already happened in bars you own.

import { atr as computeATR } from './engine.js';

function isContinuous(breakSet, start, end) {
  if (!breakSet.size) return true;
  for (let i = start; i < end - 1; i++) if (breakSet.has(i)) return false;
  return true;
}

export const STRUCTURE = {
  TREND: 'TREND',
  RANGE: 'RANGE',
  SWEEP: 'SWEEP',
  BREAKOUT: 'BREAKOUT',
};

export const STRUCTURE_KN = {
  TREND: 'ಸ್ಪಷ್ಟ Trend',
  RANGE: 'Range — ಚಲನೆ ಇಲ್ಲದ market',
  SWEEP: 'Liquidity Sweep ನಂತರ Reversal',
  BREAKOUT: 'Compression ನಂತರ Expansion',
};

/** What each structure is good for teaching, shown to the mentor. */
export const STRUCTURE_LESSON = {
  TREND: 'Trend ದಿಕ್ಕಿನಲ್ಲಿ ಮಾತ್ರ trade ಮಾಡೋದು',
  RANGE: 'Clarity ಇಲ್ಲದಾಗ trade ಮಾಡದೆ ಇರೋದು',
  SWEEP: 'Stop Loss ಅನ್ನು wick ನ ಆಚೆ ಇಡೋದು',
  BREAKOUT: 'Compression ಗುರುತಿಸಿ expansion ಗೆ ಕಾಯೋದು',
};

const sum = (a) => a.reduce((x, y) => x + y, 0);
const hi = (bars) => Math.max(...bars.map((b) => b.h));
const lo = (bars) => Math.min(...bars.map((b) => b.l));

/**
 * How directly price travelled. 1.0 is a straight line; near 0 is churn.
 * This is what separates a leg a student can read from noise that merely
 * happens to end higher.
 */
function efficiency(bars) {
  if (bars.length < 2) return 0;
  const net = Math.abs(bars[bars.length - 1].c - bars[0].o);
  const path = sum(bars.slice(1).map((b, i) => Math.abs(b.c - bars[i].c)));
  return path > 0 ? net / path : 0;
}

/** Largest adverse excursion against the eventual direction, in ATR. */
function pullback(bars, up, unit) {
  let worst = 0;
  let extreme = up ? -Infinity : Infinity;
  for (const b of bars) {
    extreme = up ? Math.max(extreme, b.h) : Math.min(extreme, b.l);
    const adverse = up ? extreme - b.l : b.h - extreme;
    worst = Math.max(worst, adverse);
  }
  return unit > 0 ? worst / unit : 0;
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

/* ------------------------------------------------------------ detectors */

function detectTrend(visible, forward, unit) {
  const net = forward[forward.length - 1].c - forward[0].o;
  const moveATR = Math.abs(net) / unit;
  const eff = efficiency(forward);
  if (moveATR < 3 || eff < 0.28) return null;

  const up = net > 0;
  const dip = pullback(forward, up, unit);

  // Distance saturates: a 25 ATR run is not three times as teachable as an
  // 8 ATR one, it is just rarer. Directness is what makes a leg readable, so
  // efficiency carries the most weight, and a leg that shakes people out loses.
  const quality = clamp(30 + Math.min(moveATR, 8) * 3 + eff * 70 - dip * 5);
  return {
    structure: STRUCTURE.TREND,
    direction: up ? 'UP' : 'DOWN',
    quality,
    detail: `${moveATR.toFixed(1)} ATR ${up ? 'ಮೇಲಕ್ಕೆ' : 'ಕೆಳಕ್ಕೆ'} · Efficiency ${(eff * 100).toFixed(0)}%`,
  };
}

function detectRange(visible, forward, unit) {
  const net = Math.abs(forward[forward.length - 1].c - forward[0].o) / unit;
  const span = (hi(forward) - lo(forward)) / unit;
  const eff = efficiency(forward);
  if (net > 2 || span > 8 || eff > 0.25) return null;

  // The best "no trade" drill is one that looks tradeable and is not: enough
  // range to tempt an entry, no net progress to reward it.
  const quality = clamp(45 + (8 - span) * 3 + (2 - net) * 10 - eff * 80);
  return {
    structure: STRUCTURE.RANGE,
    direction: 'NO_TRADE',
    quality,
    detail: `${span.toFixed(1)} ATR range · Net move ಬರೀ ${net.toFixed(1)} ATR`,
  };
}

function detectSweep(visible, forward, unit) {
  const tail = visible.slice(-30);
  const support = lo(tail);
  const resistance = hi(tail);

  for (let i = 0; i < Math.min(forward.length - 10, 25); i++) {
    const b = forward[i];

    const brokeLow = b.l < support && b.c > support;
    const brokeHigh = b.h > resistance && b.c < resistance;
    if (!brokeLow && !brokeHigh) continue;

    const up = brokeLow;
    const after = forward.slice(i + 1);
    const extreme = up ? hi(after) : lo(after);
    const travel = Math.abs(extreme - b.c) / unit;
    if (travel < 2.5) continue;

    // A shallow poke teaches nothing; a deep one that recovers is the lesson.
    const depth = up ? (support - b.l) / unit : (b.h - resistance) / unit;
    if (depth < 0.25) continue;

    const quality = clamp(35 + Math.min(travel, 10) * 3.5 + Math.min(depth, 3) * 7);
    return {
      structure: STRUCTURE.SWEEP,
      direction: up ? 'UP' : 'DOWN',
      quality,
      detail: `Bar ${i + 1} ರಲ್ಲಿ ${up ? 'support ಕೆಳಗೆ' : 'resistance ಮೇಲೆ'} ${depth.toFixed(
        1
      )} ATR ಚುಚ್ಚಿ ವಾಪಸ್ ಬಂತು · ಆಮೇಲೆ ${travel.toFixed(1)} ATR ಚಲನೆ`,
    };
  }
  return null;
}

function detectBreakout(visible, forward, unit) {
  const coil = visible.slice(-25);
  const coilSpan = (hi(coil) - lo(coil)) / unit;
  const earlier = visible.slice(-70, -25);
  if (!earlier.length) return null;
  const earlierSpan = (hi(earlier) - lo(earlier)) / unit;
  if (coilSpan > 4 || coilSpan >= earlierSpan * 0.7) return null;

  const net = forward[forward.length - 1].c - forward[0].o;
  const moveATR = Math.abs(net) / unit;
  if (moveATR < 3) return null;

  const quality = clamp(35 + (4 - coilSpan) * 7 + Math.min(moveATR, 8) * 4);
  return {
    structure: STRUCTURE.BREAKOUT,
    direction: net > 0 ? 'UP' : 'DOWN',
    quality,
    detail: `${coilSpan.toFixed(1)} ATR compression · ಆಮೇಲೆ ${moveATR.toFixed(1)} ATR expansion`,
  };
}

const DETECTORS = {
  [STRUCTURE.TREND]: detectTrend,
  [STRUCTURE.RANGE]: detectRange,
  [STRUCTURE.SWEEP]: detectSweep,
  [STRUCTURE.BREAKOUT]: detectBreakout,
};

/* --------------------------------------------------------------- scanner */

/**
 * Walk a dataset and return the best non-overlapping candidate windows.
 *
 * `stride` trades thoroughness for speed. At 10 bars a 20k dataset is about
 * two thousand evaluations, which a Worker handles comfortably.
 */
export function scanDataset(
  candles,
  {
    visible = 90,
    forward = 60,
    stride = 10,
    structures = null,
    limit = 12,
    minQuality = 45,
    breaks = null,
  } = {}
) {
  const wanted = structures?.length ? structures : Object.keys(DETECTORS);
  const breakSet = breaks instanceof Set ? breaks : new Set(breaks || []);
  const total = visible + forward;
  const found = [];

  for (let start = 0; start + total <= candles.length; start += stride) {
    // A window straddling a hole in the data shows one candle leaping hundreds
    // of points. Whatever a student concludes from that candle is false, so
    // these windows never reach the shortlist.
    if (!isContinuous(breakSet, start, start + total)) continue;
    const vis = candles.slice(start, start + visible);
    const fwd = candles.slice(start + visible, start + total);
    const unit = computeATR(vis);
    if (!(unit > 0)) continue;

    for (const key of wanted) {
      const hit = DETECTORS[key]?.(vis, fwd, unit);
      if (hit && hit.quality >= minQuality) {
        found.push({ start, visible, forward, atr: unit, ...hit });
      }
    }
  }

  // Neighbouring windows describe the same move, so keep only the best of each
  // cluster rather than handing the mentor twenty views of one event.
  found.sort((a, b) => b.quality - a.quality);
  const minGap = Math.floor(forward * 0.75);
  const perStructure = new Map();
  for (const c of found) {
    const bucket = perStructure.get(c.structure) || [];
    if (bucket.some((k) => Math.abs(k.start - c.start) < minGap)) continue;
    bucket.push(c);
    perStructure.set(c.structure, bucket);
  }

  // Sweeps are common and score high, trends and ranges are rarer. Taking the
  // global top N would hand back sixteen sweeps and hide everything else, so
  // the shortlist is filled a structure at a time.
  const buckets = [...perStructure.values()];
  const kept = [];
  for (let round = 0; kept.length < limit; round++) {
    let added = false;
    for (const bucket of buckets) {
      if (bucket[round] === undefined) continue;
      kept.push(bucket[round]);
      added = true;
      if (kept.length >= limit) break;
    }
    if (!added) break;
  }
  return kept.sort((a, b) => b.quality - a.quality);
}

/* --------------------------------------------------------------- sessions */

/** Trading session from an hour in the data's own clock. */
export function sessionOf(hour) {
  if (hour == null || !Number.isFinite(hour)) return null;
  if (hour >= 0 && hour < 7) return 'ASIA';
  if (hour >= 7 && hour < 12) return 'LONDON';
  if (hour >= 12 && hour < 17) return 'LONDON_NY';
  if (hour >= 17 && hour < 21) return 'NY';
  return 'LATE';
}

export const SESSION_KN = {
  ASIA: 'Asia',
  LONDON: 'London',
  LONDON_NY: 'London–NY Overlap',
  NY: 'New York',
  LATE: 'ತಡರಾತ್ರಿ (Late)',
};

/** Pull an hour out of the timestamp label the export gave us, if there is one. */
export function hourOf(label) {
  const m = String(label || '').match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) : null;
}
