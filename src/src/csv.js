// Turns whatever a broker terminal exported into candles.
//
// MT5's "Export bars" gives tab-separated <DATE> <TIME> <OPEN> <HIGH> <LOW>
// <CLOSE> <TICKVOL> <VOL> <SPREAD>. TradingView and most others give a comma
// file with a single timestamp column. Both land here, plus the semicolon
// variant that European locale exports produce.

const DELIMS = ['\t', ';', ','];

function pickDelimiter(line) {
  let best = ',';
  let bestCount = 0;
  for (const d of DELIMS) {
    const n = line.split(d).length;
    if (n > bestCount) {
      bestCount = n;
      best = d;
    }
  }
  return best;
}

const clean = (s) => String(s || '').replace(/^["'\s<]+|["'\s>]+$/g, '');

const toNumber = (s) => {
  const raw = clean(s).replace(/\s/g, '').replace(/,(?=\d{3}\b)/g, '');
  if (raw === '') return NaN; // an empty cell is missing data, not zero
  const v = Number(raw);
  return Number.isFinite(v) && v !== 0 ? v : NaN;
};

/** Header row, or null when the file dives straight into data. */
function readHeader(cells) {
  const lower = cells.map((c) => clean(c).toLowerCase());
  const find = (...names) => lower.findIndex((c) => names.some((n) => c === n || c === n + '>'));
  const o = find('open', 'o');
  const h = find('high', 'h');
  const l = find('low', 'l');
  const c = find('close', 'c');
  if (o < 0 || h < 0 || l < 0 || c < 0) return null;
  const date = find('date', 'time', 'datetime', 'timestamp');
  const time = lower.findIndex((x, i) => i !== date && (x === 'time' || x === 'time>'));
  return { o, h, l, c, date, time: time === date ? -1 : time };
}

/**
 * Parse an OHLC export into ascending candles.
 * Returns { candles, skipped, warning }.
 */
export function parseOHLC(text, { maxBars = 60000 } = {}) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { candles: [], skipped: 0, warning: 'File ಖಾಲಿ ಇದೆ.' };

  const delim = pickDelimiter(lines[0]);
  const rows = lines.map((l) => l.split(delim));

  let cols = readHeader(rows[0]);
  let startRow = cols ? 1 : 0;

  if (!cols) {
    // No usable header. Find the trailing run of numeric columns and assume the
    // last four of the first five numbers are O/H/L/C, which is how every
    // terminal export is laid out.
    const sample = rows.find((r) => r.filter((cell) => Number.isFinite(toNumber(cell))).length >= 4);
    if (!sample) return { candles: [], skipped: 0, warning: 'OHLC columns ಸಿಗಲಿಲ್ಲ.' };
    const numeric = [];
    sample.forEach((cell, i) => {
      if (Number.isFinite(toNumber(cell))) numeric.push(i);
    });
    const nonNumeric = sample.length - numeric.length;
    const base = numeric[0];
    cols = { o: base, h: base + 1, l: base + 2, c: base + 3, date: nonNumeric ? 0 : -1, time: -1 };
  }

  const candles = [];
  let skipped = 0;

  for (let i = startRow; i < rows.length && candles.length < maxBars; i++) {
    const r = rows[i];
    const o = toNumber(r[cols.o]);
    const h = toNumber(r[cols.h]);
    const l = toNumber(r[cols.l]);
    const c = toNumber(r[cols.c]);
    if (![o, h, l, c].every(Number.isFinite) || h < l) {
      skipped++;
      continue;
    }
    const label =
      cols.date >= 0
        ? clean(r[cols.date]) + (cols.time >= 0 && r[cols.time] ? ' ' + clean(r[cols.time]) : '')
        : String(candles.length);
    candles.push({
      t: label,
      o,
      h: Math.max(h, o, c),
      l: Math.min(l, o, c),
      c,
    });
  }

  let warning = null;
  if (!candles.length) warning = 'ಒಂದೂ ಸರಿಯಾದ candle ಸಿಗಲಿಲ್ಲ. Columns ಪರೀಕ್ಷಿಸಿ.';
  else if (skipped > candles.length * 0.1)
    warning = `${skipped} rows skip ಆದವು — file ಸರಿಯಾಗಿದೆಯಾ ನೋಡಿ.`;

  return { candles, skipped, warning };
}

/** Round-trip guard: reject a window that is flat or has gaps wide enough to be a data error. */
export function inspectWindow(candles) {
  if (candles.length < 10) return 'ಈ window ನಲ್ಲಿ ಸಾಕಷ್ಟು candle ಇಲ್ಲ.';
  const range = Math.max(...candles.map((c) => c.h)) - Math.min(...candles.map((c) => c.l));
  if (!(range > 0)) return 'ಈ window ನಲ್ಲಿ price ಚಲಿಸಿಯೇ ಇಲ್ಲ.';
  return null;
}

/* ------------------------------------------------------------ continuity */

/** Turn a broker timestamp label into epoch ms, or null if it is not one. */
export function parseTimestamp(label) {
  const s = String(label || '').trim();
  let m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})[ T](\d{1,2}):(\d{2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = Date.parse(s);
  return Number.isFinite(d) ? d : null;
}

/**
 * Find places where the series is not continuous.
 *
 * A weekend or a holiday close is normal and a student should see it. What
 * ruins a drill is a hole in the data: a missing week shows up as one candle
 * leaping hundreds of points, and any lesson drawn from that candle is false.
 *
 * So a break is flagged when the series skips more than `maxGapHours`, or when
 * price dislocates by more than `maxJumpPct` from one bar's close to the next
 * bar's open — whichever the cause, the chart is no longer readable across it.
 *
 * Returns indices `i` meaning "the series is broken between bar i and i+1".
 */
export function findBreaks(candles, { maxGapHours = 96, maxJumpPct = 1.5 } = {}) {
  const breaks = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const cur = candles[i];

    const a = parseTimestamp(prev.t);
    const b = parseTimestamp(cur.t);
    if (a != null && b != null && (b - a) / 3600000 > maxGapHours) {
      breaks.push(i - 1);
      continue;
    }
    if (prev.c > 0 && (Math.abs(cur.o - prev.c) / prev.c) * 100 > maxJumpPct) {
      breaks.push(i - 1);
    }
  }
  return breaks;
}

/** True when any break falls inside [start, end). */
export function windowIsContinuous(breakSet, start, end) {
  for (let i = start; i < end - 1; i++) if (breakSet.has(i)) return false;
  return true;
}
