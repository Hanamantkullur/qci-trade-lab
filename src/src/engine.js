// Trade simulation and session statistics.
//
// No Cloudflare imports here on purpose: the same file runs in the Worker, in
// the browser during replay, and in Node when you want to test a rule change
// against last month's sessions before it touches a student.

export const SIDE = { BUY: 'BUY', SELL: 'SELL' };

export const TRADE_STATUS = {
  PENDING: 'PENDING', // limit order waiting to be touched
  OPEN: 'OPEN',
  TP: 'TP',
  SL: 'SL',
  CLOSED: 'CLOSED', // student closed it by hand
  EXPIRED: 'EXPIRED', // replay ended before anything happened
  CANCELLED: 'CANCELLED', // pending order never filled before the replay ended
};

/**
 * Advance one trade by a single candle.
 *
 * Returns the trade unchanged when nothing happens, so a caller can fold this
 * over a candle array. Within one candle we cannot know whether the high or the
 * low came first, so a bar that spans both stop and target resolves as the
 * stop. Every honest backtester makes the same assumption.
 */
export function stepTrade(trade, candle, index) {
  if (trade.status !== TRADE_STATUS.PENDING && trade.status !== TRADE_STATUS.OPEN) return trade;
  const isBuy = trade.side === SIDE.BUY;

  if (trade.status === TRADE_STATUS.PENDING) {
    const touched = trade.entry <= candle.h && trade.entry >= candle.l;
    if (!touched) return trade;
    trade = { ...trade, status: TRADE_STATUS.OPEN, filledAt: index };
  }

  const hitSL = isBuy ? candle.l <= trade.sl : candle.h >= trade.sl;
  const hitTP = isBuy ? candle.h >= trade.tp : candle.l <= trade.tp;

  if (hitSL) return { ...trade, status: TRADE_STATUS.SL, exitIndex: index, exitPrice: trade.sl };
  if (hitTP) return { ...trade, status: TRADE_STATUS.TP, exitIndex: index, exitPrice: trade.tp };
  return trade;
}

/** Risk in price terms. Everything downstream is measured in multiples of this. */
export const riskUnit = (trade) => Math.abs(trade.entry - trade.sl);

/** Planned reward-to-risk at the moment the order was placed. */
export function plannedRR(trade) {
  const risk = riskUnit(trade);
  if (!(risk > 0)) return 0;
  return Math.abs(trade.tp - trade.entry) / risk;
}

/**
 * Realised result in R. A trade that never filled is worth 0R, not a loss —
 * patience should not be punished the way a bad entry is.
 */
export function realisedR(trade) {
  const risk = riskUnit(trade);
  if (!(risk > 0)) return 0;
  if (trade.status === TRADE_STATUS.PENDING || trade.status === TRADE_STATUS.CANCELLED) return 0;
  if (trade.exitPrice === undefined || trade.exitPrice === null) return 0;
  const move = trade.side === SIDE.BUY ? trade.exitPrice - trade.entry : trade.entry - trade.exitPrice;
  return move / risk;
}

/** Close anything still running when the replay window ends. */
export function settleOpenTrades(trades, lastCandle, lastIndex) {
  return trades.map((t) => {
    if (t.status === TRADE_STATUS.OPEN) {
      return { ...t, status: TRADE_STATUS.EXPIRED, exitIndex: lastIndex, exitPrice: lastCandle.c };
    }
    if (t.status === TRADE_STATUS.PENDING) {
      return { ...t, status: TRADE_STATUS.CANCELLED, exitIndex: lastIndex };
    }
    return t;
  });
}

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Everything a trader should be looking at after a session, expressed in R so
 * that lot size never enters the conversation.
 */
export function sessionStats(trades) {
  const filled = trades.filter(
    (t) => t.status !== TRADE_STATUS.CANCELLED && t.status !== TRADE_STATUS.PENDING
  );
  const rs = filled.map(realisedR);
  const wins = rs.filter((r) => r > 0);
  const losses = rs.filter((r) => r < 0);

  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));

  // Peak-to-trough of the running R curve.
  let running = 0;
  let peak = 0;
  let maxDD = 0;
  for (const r of rs) {
    running += r;
    peak = Math.max(peak, running);
    maxDD = Math.max(maxDD, peak - running);
  }

  const count = filled.length;
  const winRate = count ? wins.length / count : 0;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;

  return {
    placed: trades.length,
    filled: count,
    cancelled: trades.length - count,
    wins: wins.length,
    losses: losses.length,
    winRate: round(winRate * 100, 1),
    totalR: round(rs.reduce((a, b) => a + b, 0)),
    avgR: round(count ? rs.reduce((a, b) => a + b, 0) / count : 0),
    avgWinR: round(avgWin),
    avgLossR: round(avgLoss),
    // Expectancy per trade, the number that actually decides whether an edge exists.
    expectancy: round(winRate * avgWin - (1 - winRate) * avgLoss),
    profitFactor: grossLoss > 0 ? round(grossWin / grossLoss) : grossWin > 0 ? null : 0,
    maxDrawdownR: round(maxDD),
    avgPlannedRR: round(
      trades.length ? trades.reduce((a, t) => a + plannedRR(t), 0) / trades.length : 0
    ),
  };
}

/* ------------------------------------------------------------------ score */

export const SCORE_WEIGHTS = {
  RESULT: 40,
  PLANNING: 25,
  RISK: 20,
  JOURNAL: 15,
};

/** Total R is capped so one lucky runner cannot carry a reckless session. */
export const R_TARGET = 3;

/** A plan only counts as a plan inside a band a real desk would accept. */
export const RR_MIN_PLANNED = 1.5;
export const RR_MAX_PLANNED = 8;

/**
 * A drill score that a mentor can defend to a student.
 *
 * Result is only 40 of 100 on purpose. A beginner who takes two well-planned
 * trades and loses both should still outscore someone who fired twelve
 * unplanned trades into a trend and got lucky.
 */
export function drillScore(trades, stats, drill) {
  const maxTrades = drill?.max_trades || 5;
  const atr = Number(drill?.atr) || 0;

  const resultPts =
    SCORE_WEIGHTS.RESULT * Math.max(0, Math.min(1, stats.totalR / R_TARGET));

  const planned = trades.filter((t) => {
    const rr = plannedRR(t);
    return rr >= RR_MIN_PLANNED && rr <= RR_MAX_PLANNED;
  }).length;
  const planningPts = trades.length
    ? SCORE_WEIGHTS.PLANNING * (planned / trades.length)
    : 0;

  // Sane stop distance, and no more orders than the drill allows.
  const saneStops = atr > 0 ? trades.filter((t) => riskUnit(t) >= atr * 0.5).length : trades.length;
  const stopRate = trades.length ? saneStops / trades.length : 0;
  const overtrade = Math.max(0, trades.length - maxTrades) / maxTrades;
  const riskPts = SCORE_WEIGHTS.RISK * stopRate * Math.max(0, 1 - overtrade);

  const noted = trades.filter((t) => (t.note || '').trim().length >= 10).length;
  const journalPts = trades.length ? SCORE_WEIGHTS.JOURNAL * (noted / trades.length) : 0;

  const breakdown = {
    result: Math.round(resultPts),
    planning: Math.round(planningPts),
    risk: Math.round(riskPts),
    journal: Math.round(journalPts),
  };
  return { ...breakdown, total: breakdown.result + breakdown.planning + breakdown.risk + breakdown.journal };
}

/** Reject an order the moment it is placed, before it can pollute a session. */
export function validateOrder({ side, entry, sl, tp }, lastClose, atr) {
  const nums = [entry, sl, tp].map(Number);
  if (!nums.every(Number.isFinite)) return 'Entry, SL ಮತ್ತು TP — ಮೂರೂ price ಬೇಕು.';
  const [e, s, t] = nums;
  if (nums.some((n) => n <= 0)) return 'Price zero ಗಿಂತ ಹೆಚ್ಚಿರಬೇಕು.';
  if (side === SIDE.BUY && !(s < e && e < t)) return 'BUY ಗೆ: SL ಕೆಳಗೆ, TP ಮೇಲೆ ಇರಬೇಕು.';
  if (side === SIDE.SELL && !(t < e && e < s)) return 'SELL ಗೆ: SL ಮೇಲೆ, TP ಕೆಳಗೆ ಇರಬೇಕು.';
  if (![SIDE.BUY, SIDE.SELL].includes(side)) return 'BUY ಅಥವಾ SELL ಆಯ್ಕೆ ಮಾಡಿ.';
  if (atr > 0 && Math.abs(e - s) < atr * 0.25) return 'SL ತುಂಬಾ ಹತ್ತಿರ ಇದೆ. ಕನಿಷ್ಠ 0.25 ATR ದೂರ ಇಡಿ.';
  if (atr > 0 && Math.abs(e - lastClose) > atr * 12) return 'Entry market price ನಿಂದ ತುಂಬಾ ದೂರ ಇದೆ.';
  return null;
}

/** Wilder ATR, used for the stop-distance guardrails. */
export function atr(candles, period = 14) {
  if (candles.length < period + 1) return 0;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - prev.c), Math.abs(c.l - prev.c)));
  }
  let a = trs.slice(0, period).reduce((x, y) => x + y, 0) / period;
  for (let i = period; i < trs.length; i++) a = (a * (period - 1) + trs[i]) / period;
  return a;
}
