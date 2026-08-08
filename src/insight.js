// Reads a student's habits out of their own trade history.
//
// This is the piece that makes the platform feel like a mentor rather than a
// scoreboard. It predicts nothing and it never comments on a single trade —
// one bad trade is noise. It only speaks when a pattern repeats often enough
// across enough trades to be a habit worth naming.
//
// Every finding must be traceable to a number the student can check themselves.
// A vague "work on your discipline" teaches nobody anything; "your last twelve
// stops averaged 0.6 ATR, and nine of them were hit" is actionable.

import { riskUnit, plannedRR, realisedR, TRADE_STATUS, SIDE } from './engine.js';

export const SEVERITY = { STRENGTH: 'strength', WATCH: 'watch', FIX: 'fix' };

/** Below this many trades, nothing is a pattern yet. */
export const MIN_TRADES = 8;

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Flatten finished sessions into trades that still remember their drill.
 * `sessions` items look like { trades: [...], atr, bias, max_trades, title }.
 */
export function collectTrades(sessions) {
  const out = [];
  for (const s of sessions) {
    const trades = Array.isArray(s.trades) ? s.trades : JSON.parse(s.trades || '[]');
    trades.forEach((t, i) =>
      out.push({
        ...t,
        drillAtr: Number(s.atr) || 0,
        drillBias: s.bias || null,
        drillMax: Number(s.max_trades) || 3,
        drillTitle: s.title || '',
        orderIndex: i,
      })
    );
  }
  return out;
}

/* ---------------------------------------------------------- the readings */

function counterTrend(trades) {
  const withBias = trades.filter((t) => t.drillBias === 'UP' || t.drillBias === 'DOWN');
  if (withBias.length < MIN_TRADES) return null;
  const against = withBias.filter(
    (t) => (t.drillBias === 'UP' && t.side === SIDE.SELL) || (t.drillBias === 'DOWN' && t.side === SIDE.BUY)
  );
  const share = pct(against.length, withBias.length);
  if (share < 35) return null;

  const lost = against.filter((t) => realisedR(t) < 0).length;
  return {
    kind: 'counter_trend',
    severity: share >= 50 ? SEVERITY.FIX : SEVERITY.WATCH,
    title: 'ಪ್ರವೃತ್ತಿಗೆ ವಿರುದ್ಧವಾಗಿ ಟ್ರೇಡ್',
    detail: `ನಿಮ್ಮ ${withBias.length} ಟ್ರೇಡ್‌ಗಳಲ್ಲಿ ${against.length} ಚಾರ್ಟ್‌ನ ದಿಕ್ಕಿಗೆ ವಿರುದ್ಧವಾಗಿದ್ದವು (${share}%), ಅವುಗಳಲ್ಲಿ ${lost} ನಷ್ಟದಲ್ಲಿ ಮುಗಿದವು. ಪ್ರವೃತ್ತಿಯನ್ನು ಮೊದಲು ಗುರುತಿಸಿ, ಆಮೇಲೆ ಪ್ರವೇಶ ಹುಡುಕಿ.`,
  };
}

function tightStops(trades) {
  const measurable = trades.filter((t) => t.drillAtr > 0);
  if (measurable.length < MIN_TRADES) return null;
  const ratios = measurable.map((t) => riskUnit(t) / t.drillAtr);
  const mid = median(ratios);
  if (mid >= 0.9) return null;

  const stopped = measurable.filter((t) => t.status === TRADE_STATUS.SL).length;
  return {
    kind: 'tight_stops',
    severity: mid < 0.6 ? SEVERITY.FIX : SEVERITY.WATCH,
    title: 'ಸ್ಟಾಪ್ ತುಂಬಾ ಬಿಗಿಯಾಗಿದೆ',
    detail: `ನಿಮ್ಮ ಸ್ಟಾಪ್ ಸರಾಸರಿ ${mid.toFixed(2)} ATR ದೂರ ಇದೆ — ಮಾರುಕಟ್ಟೆಯ ಸಾಮಾನ್ಯ ಏರಿಳಿತಕ್ಕಿಂತ ಕಡಿಮೆ. ${measurable.length} ಟ್ರೇಡ್‌ಗಳಲ್ಲಿ ${stopped} ಸ್ಟಾಪ್ ಹಿಟ್ ಆದವು. ಸ್ಟಾಪ್ ಅನ್ನು ರಚನೆಯ ಆಚೆ ಇಡಿ, ಬೆಲೆಯ ಪಕ್ಕದಲ್ಲಿ ಅಲ್ಲ.`,
  };
}

function thinPlans(trades) {
  if (trades.length < MIN_TRADES) return null;
  const thin = trades.filter((t) => {
    const rr = plannedRR(t);
    return rr > 0 && rr < 1.5;
  });
  const share = pct(thin.length, trades.length);
  if (share < 35) return null;
  return {
    kind: 'thin_plans',
    severity: share >= 55 ? SEVERITY.FIX : SEVERITY.WATCH,
    title: 'ಗುರಿ ತುಂಬಾ ಹತ್ತಿರ',
    detail: `${trades.length} ರಲ್ಲಿ ${thin.length} ಟ್ರೇಡ್‌ಗಳ ಯೋಜಿತ ಅನುಪಾತ 1:1.5 ಗಿಂತ ಕಡಿಮೆ (${share}%). ಇಂಥ ಅನುಪಾತದಲ್ಲಿ ಲಾಭ ಉಳಿಯಬೇಕಾದರೆ ಬಹುತೇಕ ಪ್ರತಿ ಟ್ರೇಡ್ ಗೆಲ್ಲಬೇಕು — ಅದು ಯಾರಿಗೂ ಸಾಧ್ಯವಿಲ್ಲ.`,
  };
}

function cutsWinners(trades) {
  const closed = trades.filter((t) => t.status === TRADE_STATUS.CLOSED);
  if (closed.length < 4) return null;
  const early = closed.filter((t) => {
    const r = realisedR(t);
    const plan = plannedRR(t);
    return r > 0 && plan > 0 && r < plan * 0.5;
  });
  if (early.length < 3) return null;
  return {
    kind: 'cuts_winners',
    severity: SEVERITY.WATCH,
    title: 'ಲಾಭದ ಟ್ರೇಡ್ ಬೇಗ ಮುಚ್ಚುತ್ತೀರಿ',
    detail: `ನೀವು ಕೈಯಿಂದ ಮುಚ್ಚಿದ ${closed.length} ಟ್ರೇಡ್‌ಗಳಲ್ಲಿ ${early.length} ಗುರಿಯ ಅರ್ಧಕ್ಕಿಂತ ಮೊದಲೇ ಮುಚ್ಚಿದವು. ಸಣ್ಣ ಲಾಭ ಸುರಕ್ಷಿತ ಅನಿಸುತ್ತೆ, ಆದರೆ ದೊಡ್ಡ ಗೆಲುವುಗಳೇ ನಷ್ಟಗಳನ್ನು ತುಂಬುವುದು.`,
  };
}

function overtrades(sessions, trades) {
  const full = sessions.filter((s) => {
    const list = Array.isArray(s.trades) ? s.trades : JSON.parse(s.trades || '[]');
    return list.length >= (Number(s.max_trades) || 3);
  });
  if (sessions.length < 3 || full.length < Math.ceil(sessions.length * 0.7)) return null;
  return {
    kind: 'overtrades',
    severity: SEVERITY.WATCH,
    title: 'ಪ್ರತಿ ಡ್ರಿಲ್‌ನಲ್ಲೂ ಎಲ್ಲಾ ಆರ್ಡರ್ ಬಳಸುತ್ತೀರಿ',
    detail: `${sessions.length} ಡ್ರಿಲ್‌ಗಳಲ್ಲಿ ${full.length} ರಲ್ಲಿ ನೀವು ಮಿತಿಯಷ್ಟೂ ಆರ್ಡರ್ ಇಟ್ಟಿದ್ದೀರಿ. ಮಿತಿ ಎಂದರೆ ಗುರಿ ಅಲ್ಲ. ಒಳ್ಳೆಯ ಅವಕಾಶ ಇಲ್ಲದಿದ್ದಾಗ ಸುಮ್ಮನಿರುವುದೂ ಒಂದು ನಿರ್ಧಾರ.`,
  };
}

function noJournal(trades) {
  if (trades.length < MIN_TRADES) return null;
  const written = trades.filter((t) => (t.note || '').trim().length >= 10);
  const share = pct(written.length, trades.length);
  if (share >= 60) return null;
  return {
    kind: 'no_journal',
    severity: SEVERITY.FIX,
    title: 'ಕಾರಣ ಬರೆಯುತ್ತಿಲ್ಲ',
    detail: `${trades.length} ಟ್ರೇಡ್‌ಗಳಲ್ಲಿ ${written.length} ಕ್ಕೆ ಮಾತ್ರ ಕಾರಣ ಬರೆದಿದ್ದೀರಿ (${share}%). ಕಾರಣ ಬರೆಯದ ಟ್ರೇಡ್‌ನಿಂದ ಕಲಿಯಲು ಏನೂ ಉಳಿಯುವುದಿಲ್ಲ — ಗೆದ್ದರೂ ಸೋತರೂ.`,
  };
}

/* Strengths matter: a mentor who only names faults stops being believed. */

function goodPatience(trades) {
  const withBias = trades.filter((t) => t.drillBias === 'UP' || t.drillBias === 'DOWN');
  if (withBias.length < MIN_TRADES) return null;
  const aligned = withBias.filter(
    (t) => (t.drillBias === 'UP' && t.side === SIDE.BUY) || (t.drillBias === 'DOWN' && t.side === SIDE.SELL)
  );
  const share = pct(aligned.length, withBias.length);
  if (share < 75) return null;
  return {
    kind: 'trend_aligned',
    severity: SEVERITY.STRENGTH,
    title: 'ಪ್ರವೃತ್ತಿಯ ಜೊತೆ ಹೋಗುತ್ತೀರಿ',
    detail: `${withBias.length} ರಲ್ಲಿ ${aligned.length} ಟ್ರೇಡ್ ಚಾರ್ಟ್‌ನ ದಿಕ್ಕಿನಲ್ಲೇ ಇದ್ದವು (${share}%). ಇದು ಬಹಳ ಜನಕ್ಕೆ ವರ್ಷಗಟ್ಟಲೆ ಸಿಗದ ಶಿಸ್ತು.`,
  };
}

function goodPlanning(trades) {
  if (trades.length < MIN_TRADES) return null;
  const good = trades.filter((t) => {
    const rr = plannedRR(t);
    return rr >= 2 && rr <= 8;
  });
  const share = pct(good.length, trades.length);
  if (share < 70) return null;
  return {
    kind: 'strong_rr',
    severity: SEVERITY.STRENGTH,
    title: 'ಅನುಪಾತ ಚೆನ್ನಾಗಿ ಯೋಜಿಸುತ್ತೀರಿ',
    detail: `${trades.length} ರಲ್ಲಿ ${good.length} ಟ್ರೇಡ್ 1:2 ಕ್ಕಿಂತ ಒಳ್ಳೆಯ ಅನುಪಾತದಲ್ಲಿ ಇದ್ದವು (${share}%). ಗೆಲುವಿನ ಪ್ರಮಾಣ ಅರ್ಧಕ್ಕಿಂತ ಕಡಿಮೆ ಇದ್ದರೂ ಇಂಥ ಯೋಜನೆ ಲಾಭ ಕೊಡುತ್ತೆ.`,
  };
}

function goodPatienceNoTrade(sessions) {
  if (sessions.length < 4) return null;
  const quiet = sessions.filter((s) => {
    const list = Array.isArray(s.trades) ? s.trades : JSON.parse(s.trades || '[]');
    return list.length === 0;
  });
  if (quiet.length < 1 || quiet.length > sessions.length * 0.5) return null;
  return {
    kind: 'sits_out',
    severity: SEVERITY.STRENGTH,
    title: 'ಸ್ಪಷ್ಟತೆ ಇಲ್ಲದಾಗ ಸುಮ್ಮನಿರುತ್ತೀರಿ',
    detail: `${sessions.length} ಡ್ರಿಲ್‌ಗಳಲ್ಲಿ ${quiet.length} ರಲ್ಲಿ ನೀವು ಒಂದೂ ಆರ್ಡರ್ ಇಡಲಿಲ್ಲ. ಬಹಳ ಟ್ರೇಡರ್‌ಗಳಿಗೆ ಇದೇ ಅತಿ ಕಷ್ಟದ ಕೌಶಲ್ಯ.`,
  };
}

/* -------------------------------------------------------------- assembly */

const ORDER = { fix: 0, watch: 1, strength: 2 };

/**
 * Read every habit worth naming, worst first, strengths last.
 * `limit` keeps the page honest — six findings is a lesson, twenty is a wall.
 */
export function readHabits(sessions, { limit = 6 } = {}) {
  const trades = collectTrades(sessions);
  if (trades.length < MIN_TRADES) {
    return {
      ready: false,
      needed: MIN_TRADES - trades.length,
      findings: [],
      trades: trades.length,
    };
  }

  const findings = [
    counterTrend(trades),
    tightStops(trades),
    thinPlans(trades),
    cutsWinners(trades),
    overtrades(sessions, trades),
    noJournal(trades),
    goodPatience(trades),
    goodPlanning(trades),
    goodPatienceNoTrade(sessions),
  ]
    .filter(Boolean)
    .sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

  return { ready: true, findings: findings.slice(0, limit), trades: trades.length };
}
