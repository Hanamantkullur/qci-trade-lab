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
    title: 'Trend ಗೆ ವಿರುದ್ಧವಾಗಿ Trade',
    detail: `ನಿಮ್ಮ ${withBias.length} trades ನಲ್ಲಿ ${against.length} chart ನ direction ಗೆ ವಿರುದ್ಧ ಇದ್ದವು (${share}%), ಅದರಲ್ಲಿ ${lost} loss ನಲ್ಲಿ ಮುಗಿದವು. ಮೊದಲು trend ಗುರುತಿಸಿ, ಆಮೇಲೆ entry ಹುಡುಕಿ.`,
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
    title: 'Stop Loss ತುಂಬಾ ಬಿಗಿ ಇದೆ',
    detail: `ನಿಮ್ಮ Stop Loss average ${mid.toFixed(2)} ATR ದೂರ ಇದೆ — market ನ normal movement ಗಿಂತ ಕಡಿಮೆ. ${measurable.length} trades ನಲ್ಲಿ ${stopped} SL hit ಆದವು. Stop ಅನ್ನು structure ನ ಆಚೆ ಇಡಿ, price ನ ಪಕ್ಕದಲ್ಲಿ ಅಲ್ಲ.`,
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
    title: 'Target ತುಂಬಾ ಹತ್ತಿರ',
    detail: `${trades.length} ರಲ್ಲಿ ${thin.length} trades ನ planned R:R 1:1.5 ಗಿಂತ ಕಡಿಮೆ (${share}%). ಇಂಥ ratio ನಲ್ಲಿ profit ಉಳಿಬೇಕಾದ್ರೆ ಬಹುತೇಕ ಪ್ರತಿ trade ಗೆಲ್ಲಬೇಕು — ಅದು ಯಾರಿಗೂ ಸಾಧ್ಯ ಇಲ್ಲ.`,
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
    title: 'Winning trade ಬೇಗ close ಮಾಡ್ತೀರಿ',
    detail: `ನೀವು ಕೈಯಿಂದ close ಮಾಡಿದ ${closed.length} trades ನಲ್ಲಿ ${early.length} target ನ ಅರ್ಧಕ್ಕಿಂತ ಮೊದಲೇ close ಆದವು. ಸಣ್ಣ profit safe ಅನಿಸುತ್ತೆ, ಆದ್ರೆ ದೊಡ್ಡ winners ಗಳೇ losses ಅನ್ನ ತುಂಬೋದು.`,
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
    title: 'ಪ್ರತಿ Drill ನಲ್ಲೂ ಎಲ್ಲಾ Orders ಬಳಸ್ತೀರಿ',
    detail: `${sessions.length} drills ನಲ್ಲಿ ${full.length} ರಲ್ಲಿ ನೀವು limit ನಷ್ಟೂ orders ಇಟ್ಟಿದ್ದೀರಿ. Limit ಅಂದ್ರೆ target ಅಲ್ಲ. ಒಳ್ಳೆ setup ಇಲ್ಲದಿದ್ದಾಗ ಸುಮ್ಮನಿರೋದೂ ಒಂದು decision.`,
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
    title: 'Reason ಬರೀತಿಲ್ಲ',
    detail: `${trades.length} trades ನಲ್ಲಿ ${written.length} ಕ್ಕೆ ಮಾತ್ರ reason ಬರೆದಿದ್ದೀರಿ (${share}%). Reason ಬರೆಯದ trade ನಿಂದ ಕಲಿಯೋಕೆ ಏನೂ ಉಳಿಯಲ್ಲ — ಗೆದ್ರೂ ಸೋತ್ರೂ.`,
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
    title: 'Trend ಜೊತೆ ಹೋಗ್ತೀರಿ',
    detail: `${withBias.length} ರಲ್ಲಿ ${aligned.length} trades chart ನ direction ನಲ್ಲೇ ಇದ್ದವು (${share}%). ಇದು ಬಹಳ ಜನಕ್ಕೆ ವರ್ಷಗಟ್ಟಲೆ ಸಿಗದ discipline.`,
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
    title: 'R:R ಚೆನ್ನಾಗಿ plan ಮಾಡ್ತೀರಿ',
    detail: `${trades.length} ರಲ್ಲಿ ${good.length} trades 1:2 ಗಿಂತ ಒಳ್ಳೆ ratio ನಲ್ಲಿ ಇದ್ದವು (${share}%). Win rate ಅರ್ಧಕ್ಕಿಂತ ಕಡಿಮೆ ಇದ್ರೂ ಇಂಥ planning profit ಕೊಡುತ್ತೆ.`,
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
    title: 'Clarity ಇಲ್ಲದಾಗ ಸುಮ್ಮನಿರ್ತೀರಿ',
    detail: `${sessions.length} drills ನಲ್ಲಿ ${quiet.length} ರಲ್ಲಿ ನೀವು ಒಂದೂ order ಇಡಲಿಲ್ಲ. ಬಹಳ traders ಗೆ ಇದೇ ಅತಿ ಕಷ್ಟದ skill.`,
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
