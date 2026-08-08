import {
  homePage,
  replayPage,
  startPage,
  resultPage,
  leaderboardPage,
  mePage,
  messagePage,
} from './ui.js';
import { adminLogin, adminHome, adminDrillForm, adminSessions, adminScan } from './admin.js';
import { scanDataset, STRUCTURE, STRUCTURE_KN, STRUCTURE_LESSON } from './scan.js';
import { readHabits } from './insight.js';
import { REPLAY_JS } from './chart.js';
import { CLIENT_JS } from './replay-client.js';
import { parseOHLC, inspectWindow, findBreaks, windowIsContinuous } from './csv.js';
import {
  SIDE,
  TRADE_STATUS,
  stepTrade,
  settleOpenTrades,
  sessionStats,
  drillScore,
  realisedR,
  plannedRR,
  validateOrder,
  atr as computeATR,
} from './engine.js';

/* ------------------------------------------------------------- helpers */

const html = (body, status = 200) =>
  new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'same-origin',
    },
  });

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

const redirect = (location, headers = {}) =>
  new Response(null, { status: 302, headers: { location, ...headers } });

export function normalisePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

export const maskPhone = (p) => (p && p.length === 10 ? `${p.slice(0, 2)}••••${p.slice(6)}` : '');

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function cookie(request, name) {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

const isAdmin = async (request, env) =>
  Boolean(env.ADMIN_KEY) && cookie(request, 'qci_lab_admin') === (await sha256Hex(env.ADMIN_KEY));

const readJSON = async (request) => {
  try {
    return await request.json();
  } catch {
    return {};
  }
};

async function readForm(request) {
  const fd = await request.formData();
  const out = {};
  for (const [k, v] of fd.entries()) if (typeof v === 'string') out[k] = v.trim();
  return { fd, out };
}

/** Drill windows live in R2 as one small JSON object each. */
const drillCandles = async (env, drill) => {
  const obj = await env.DATA.get(drill.r2_key);
  if (!obj) return null;
  return JSON.parse(await obj.text());
};

/* --------------------------------------------------- session mechanics */

/**
 * Rebuild a session's trade list from scratch against the bars revealed so far.
 *
 * Replaying from the beginning each time is a little wasteful, but it means the
 * stored trades can never drift out of sync with the candles, and a session is
 * cheap: a few hundred bars at most.
 */
function replayTrades(trades, candles, visibleBars, cursor) {
  const upto = visibleBars + cursor;
  return trades.map((t) => {
    let cur = { ...t };
    if (cur.status !== TRADE_STATUS.PENDING && cur.status !== TRADE_STATUS.OPEN) return cur;
    for (let i = cur.placedAt + 1; i < upto && i < candles.length; i++) {
      cur = stepTrade(cur, candles[i], i);
      if (cur.status !== TRADE_STATUS.PENDING && cur.status !== TRADE_STATUS.OPEN) break;
    }
    return cur;
  });
}

const decorate = (trades) =>
  trades.map((t) => ({
    ...t,
    plannedRR: Math.round(plannedRR(t) * 100) / 100,
    realisedR:
      t.status === TRADE_STATUS.OPEN || t.status === TRADE_STATUS.PENDING
        ? null
        : Math.round(realisedR(t) * 100) / 100,
  }));

async function loadSession(request, env) {
  const token = cookie(request, 'qci_lab_session');
  if (!token) return null;
  const session = await env.DB.prepare('SELECT * FROM sessions WHERE token = ?').bind(token).first();
  if (!session) return null;
  const drill = await env.DB.prepare('SELECT * FROM drills WHERE id = ?').bind(session.drill_id).first();
  if (!drill) return null;
  return { session, drill };
}

async function saveSession(env, session, trades, cursor) {
  await env.DB.prepare('UPDATE sessions SET trades = ?, cursor = ? WHERE id = ?')
    .bind(JSON.stringify(trades), cursor, session.id)
    .run();
}

/** Everything the browser is allowed to know right now, and not one candle more. */
function sessionView(drill, candles, trades, cursor, sentSoFar) {
  const upto = Math.min(drill.visible_bars + cursor, candles.length);
  return {
    candles: candles.slice(sentSoFar, upto),
    trades: decorate(trades),
    left: Math.max(0, drill.max_trades - trades.length),
    remaining: Math.max(0, drill.visible_bars + drill.forward_bars - upto),
  };
}

async function finishSession(env, session, drill, candles, trades) {
  const lastIndex = Math.min(drill.visible_bars + session.cursor, candles.length) - 1;
  const settled = settleOpenTrades(trades, candles[lastIndex], lastIndex);
  const stats = sessionStats(settled);
  const score = drillScore(settled, stats, drill);

  await env.DB.prepare(
    `UPDATE sessions SET trades = ?, stats = ?, score = ?, total_score = ?, total_r = ?,
     finished_at = datetime('now') WHERE id = ?`
  )
    .bind(
      JSON.stringify(decorate(settled)),
      JSON.stringify(stats),
      JSON.stringify(score),
      score.total,
      stats.totalR,
      session.id
    )
    .run();

  return { stats, score, trades: settled };
}

/* ------------------------------------------------------------- routing */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method;

    try {
      /* ---- static ---- */
      if (path === '/static/chart.js' || path === '/static/replay.js') {
        return new Response(path.endsWith('chart.js') ? REPLAY_JS : CLIENT_JS, {
          headers: {
            'content-type': 'application/javascript; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        });
      }

      /* ---- replay API ---- */
      if (path.startsWith('/api/session/')) {
        const found = await loadSession(request, env);
        if (!found) return json({ error: 'Session ಸಿಗಲಿಲ್ಲ. Page refresh ಮಾಡಿ.' }, 401);
        const { session, drill } = found;

        if (session.finished_at) return json({ finished: true });

        const candles = await drillCandles(env, drill);
        if (!candles) return json({ error: 'Data ಸಿಗಲಿಲ್ಲ.' }, 500);

        let trades = JSON.parse(session.trades);
        let cursor = session.cursor;
        const body = await readJSON(request);

        if (path === '/api/session/state') {
          trades = replayTrades(trades, candles, drill.visible_bars, cursor);
          return json(sessionView(drill, candles, trades, cursor, 0));
        }

        if (path === '/api/session/next') {
          const maxCursor = drill.forward_bars;
          if (cursor >= maxCursor || drill.visible_bars + cursor >= candles.length) {
            const r = await finishSession(env, session, drill, candles, trades);
            return json({ finished: true, ...r });
          }
          cursor += 1;
          trades = replayTrades(trades, candles, drill.visible_bars, cursor);
          await saveSession(env, session, trades, cursor);
          const view = sessionView(drill, candles, trades, cursor, drill.visible_bars + cursor - 1);
          if (view.remaining === 0) {
            await finishSession(env, { ...session, cursor }, drill, candles, trades);
            return json({ ...view, finished: true });
          }
          return json(view);
        }

        if (path === '/api/session/order') {
          if (trades.length >= drill.max_trades)
            return json({ error: 'ಈ drill ನ order limit ಮುಗಿದಿದೆ.' }, 400);
          if (trades.some((t) => t.status === TRADE_STATUS.OPEN || t.status === TRADE_STATUS.PENDING))
            return json({ error: 'ಈಗಾಗಲೇ ಒಂದು trade open ಇದೆ. ಮೊದಲು ಅದನ್ನ ಮುಗಿಸಿ.' }, 400);

          const index = Math.min(drill.visible_bars + cursor, candles.length) - 1;
          const lastClose = candles[index].c;
          const problem = validateOrder(body, lastClose, drill.atr || 0);
          if (problem) return json({ error: problem }, 400);

          const tolerance = (drill.atr || Math.abs(lastClose) * 0.0005) * 0.1;
          const market = Math.abs(Number(body.entry) - lastClose) <= tolerance;

          trades = trades.concat([
            {
              side: body.side === SIDE.SELL ? SIDE.SELL : SIDE.BUY,
              entry: Number(body.entry),
              sl: Number(body.sl),
              tp: Number(body.tp),
              note: String(body.note || '').slice(0, 300),
              placedAt: index,
              filledAt: market ? index : null,
              status: market ? TRADE_STATUS.OPEN : TRADE_STATUS.PENDING,
            },
          ]);
          await saveSession(env, session, trades, cursor);
          return json({ trades: decorate(trades), left: drill.max_trades - trades.length });
        }

        if (path === '/api/session/close') {
          const index = Math.min(drill.visible_bars + cursor, candles.length) - 1;
          const price = candles[index].c;
          trades = trades.map((t) =>
            t.status === TRADE_STATUS.OPEN
              ? { ...t, status: TRADE_STATUS.CLOSED, exitIndex: index, exitPrice: price }
              : t
          );
          await saveSession(env, session, trades, cursor);
          return json({ trades: decorate(trades) });
        }

        if (path === '/api/session/finish') {
          const r = await finishSession(env, session, drill, candles, trades);
          return json({ finished: true, ...r });
        }

        return json({ error: 'unknown' }, 404);
      }

      /* ---- admin ---- */
      if (path === '/admin/login' && method === 'POST') {
        const { out } = await readForm(request);
        if (!env.ADMIN_KEY) return html(adminLogin('ADMIN_KEY secret is not set.'), 500);
        if (out.key !== env.ADMIN_KEY) return html(adminLogin('Wrong key.'), 401);
        return redirect('/admin', {
          'set-cookie': `qci_lab_admin=${await sha256Hex(
            env.ADMIN_KEY
          )}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`,
        });
      }
      if (path === '/admin/logout')
        return redirect('/admin', {
          'set-cookie': 'qci_lab_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
        });

      if (path.startsWith('/admin')) {
        if (!(await isAdmin(request, env))) return html(adminLogin(null), 401);
        return adminRoutes(request, env, path, method, url);
      }

      /* ---- drill result ---- */
      const resMatch = path.match(/^\/drill\/(\d+)\/result$/);
      if (resMatch) {
        const drill = await env.DB.prepare('SELECT * FROM drills WHERE id = ?').bind(resMatch[1]).first();
        if (!drill) return html(messagePage('ಸಿಗಲಿಲ್ಲ', 'ಈ drill ಇಲ್ಲ.', { kind: 'bad' }), 404);

        const token = cookie(request, 'qci_lab_session');
        const session = token
          ? await env.DB.prepare('SELECT * FROM sessions WHERE token = ? AND drill_id = ?')
              .bind(token, drill.id)
              .first()
          : null;
        if (!session || !session.finished_at)
          return html(messagePage('ಇನ್ನೂ ಮುಗಿದಿಲ್ಲ', 'ಈ drill ನ session ಇನ್ನೂ ಮುಗಿದಿಲ್ಲ.'));

        const rankRow = await env.DB.prepare(
          `SELECT COUNT(*) AS total,
                  SUM(CASE WHEN total_score > ? THEN 1 ELSE 0 END) AS above
           FROM sessions WHERE drill_id = ? AND finished_at IS NOT NULL`
        )
          .bind(session.total_score, drill.id)
          .first();

        return html(
          resultPage(
            drill,
            session,
            JSON.parse(session.stats),
            JSON.parse(session.score),
            JSON.parse(session.trades),
            { pos: (rankRow?.above ?? 0) + 1, total: rankRow?.total ?? 1 }
          )
        );
      }

      /* ---- start a drill ---- */
      const startMatch = path.match(/^\/drill\/(\d+)\/start$/);
      if (startMatch && method === 'POST') {
        const drill = await env.DB.prepare(`SELECT * FROM drills WHERE id = ? AND status = 'live'`)
          .bind(startMatch[1])
          .first();
        if (!drill) return html(messagePage('ಸಿಗಲಿಲ್ಲ', 'ಈ drill ಲಭ್ಯ ಇಲ್ಲ.', { kind: 'bad' }), 404);

        const { out } = await readForm(request);
        const phone = normalisePhone(out.phone);
        if (!phone) return html(startPage(drill, 'ಸರಿಯಾದ 10 digit number ಹಾಕಿ.'), 400);
        if (!out.name) return html(startPage(drill, 'ಹೆಸರು ಹಾಕಿ.'), 400);

        await env.DB.prepare(
          `INSERT INTO students (phone, name) VALUES (?, ?)
           ON CONFLICT(phone) DO UPDATE SET name = excluded.name`
        )
          .bind(phone, out.name.slice(0, 60))
          .run();
        const student = await env.DB.prepare('SELECT * FROM students WHERE phone = ?').bind(phone).first();

        let session = await env.DB.prepare('SELECT * FROM sessions WHERE drill_id = ? AND student_id = ?')
          .bind(drill.id, student.id)
          .first();

        if (!session) {
          const token = crypto.randomUUID().replace(/-/g, '');
          await env.DB.prepare('INSERT INTO sessions (drill_id, student_id, token) VALUES (?,?,?)')
            .bind(drill.id, student.id, token)
            .run();
          session = { token };
        }

        const target = session.finished_at ? `/drill/${drill.id}/result` : `/drill/${drill.id}`;
        return redirect(target, {
          'set-cookie': `qci_lab_session=${session.token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
        });
      }

      /* ---- drill page ---- */
      const drillMatch = path.match(/^\/drill\/(\d+)$/);
      if (drillMatch) {
        const drill = await env.DB.prepare(`SELECT * FROM drills WHERE id = ? AND status = 'live'`)
          .bind(drillMatch[1])
          .first();
        if (!drill) return html(messagePage('ಸಿಗಲಿಲ್ಲ', 'ಈ drill ಲಭ್ಯ ಇಲ್ಲ.', { kind: 'bad' }), 404);

        const token = cookie(request, 'qci_lab_session');
        const session = token
          ? await env.DB.prepare('SELECT * FROM sessions WHERE token = ? AND drill_id = ?')
              .bind(token, drill.id)
              .first()
          : null;

        if (!session) return html(startPage(drill));
        if (session.finished_at) return redirect(`/drill/${drill.id}/result`);

        const student = await env.DB.prepare('SELECT * FROM students WHERE id = ?')
          .bind(session.student_id)
          .first();
        return html(replayPage(drill, student));
      }

      /* ---- leaderboard ---- */
      if (path === '/leaderboard') {
        const { results } = await env.DB.prepare(
          `SELECT st.name AS name, st.phone AS phone,
                  COUNT(*) AS drills, AVG(s.total_score) AS avg
           FROM sessions s JOIN students st ON st.id = s.student_id
           WHERE s.finished_at IS NOT NULL
           GROUP BY st.id HAVING drills >= 3
           ORDER BY avg DESC LIMIT 25`
        ).all();
        return html(leaderboardPage(results.map((r) => ({ ...r, masked: maskPhone(r.phone) }))));
      }

      /* ---- personal record ---- */
      if (path === '/me') {
        const raw = url.searchParams.get('phone');
        if (!raw) return html(mePage({}));
        const phone = normalisePhone(raw);
        if (!phone) return html(mePage({ phone: raw, error: 'ಸರಿಯಾದ 10 digit number ಹಾಕಿ.' }));

        const student = await env.DB.prepare('SELECT * FROM students WHERE phone = ?').bind(phone).first();
        if (!student) return html(mePage({ phone, error: 'ಈ number ನಿಂದ ಇನ್ನೂ ಯಾವುದೇ session ಇಲ್ಲ.' }));

        const { results: rows } = await env.DB.prepare(
          `SELECT s.*, d.title AS title, d.atr AS atr, d.bias AS bias, d.max_trades AS max_trades
           FROM sessions s JOIN drills d ON d.id = s.drill_id
           WHERE s.student_id = ? AND s.finished_at IS NOT NULL ORDER BY s.finished_at DESC`
        )
          .bind(student.id)
          .all();

        const allTrades = rows.flatMap((r) => JSON.parse(r.trades));
        const agg = sessionStats(allTrades);
        const habits = readHabits(rows);
        return html(
          mePage({
            phone,
            student,
            rows,
            habits,
            agg: {
              drills: rows.length,
              avgScore: rows.length ? rows.reduce((a, r) => a + r.total_score, 0) / rows.length : 0,
              totalR: agg.totalR,
              trades: agg.filled,
              winRate: agg.winRate,
              expectancy: agg.expectancy,
            },
          })
        );
      }

      /* ---- home ---- */
      if (path === '/') {
        const { results: drills } = await env.DB.prepare(
          `SELECT * FROM drills WHERE status = 'live' ORDER BY level ASC, sort_order ASC, id ASC`
        ).all();

        const token = cookie(request, 'qci_lab_session');
        let done = {};
        if (token) {
          const me = await env.DB.prepare('SELECT student_id FROM sessions WHERE token = ?')
            .bind(token)
            .first();
          if (me) {
            const { results } = await env.DB.prepare(
              `SELECT drill_id, total_score FROM sessions WHERE student_id = ? AND finished_at IS NOT NULL`
            )
              .bind(me.student_id)
              .all();
            done = Object.fromEntries(results.map((r) => [r.drill_id, r]));
          }
        }

        const byLevel = {};
        for (const d of drills) (byLevel[d.level] ||= []).push(d);

        // A level opens once two of the previous level's drills are cleared at 60+.
        // Beginners jumping straight to the hardest window learn nothing from it.
        const cleared = {};
        for (const d of drills) {
          const s = done[d.id];
          if (s && s.total_score >= 60) cleared[d.level] = (cleared[d.level] || 0) + 1;
        }
        const unlocked = {};
        let open = true;
        for (const lv of Object.keys(byLevel).sort((a, b) => a - b)) {
          unlocked[lv] = open;
          open = open && (cleared[lv] || 0) >= 2;
        }
        return html(homePage(byLevel, done, unlocked));
      }

      return html(messagePage('ಸಿಗಲಿಲ್ಲ', 'ಈ page ಇಲ್ಲ.', { kind: 'bad' }), 404);
    } catch (err) {
      console.error(err);
      if (path.startsWith('/api/')) return json({ error: 'Server error.' }, 500);
      return html(messagePage('ತೊಂದರೆ ಆಯ್ತು', 'Server error. ಮತ್ತೆ try ಮಾಡಿ.', { kind: 'bad' }), 500);
    }
  },
};

/* --------------------------------------------------------- admin side */

async function adminRoutes(request, env, path, method, url) {
  if (path === '/admin') {
    const { results: datasets } = await env.DB.prepare(
      'SELECT * FROM datasets ORDER BY created_at DESC'
    ).all();
    const { results: drills } = await env.DB.prepare(
      `SELECT d.*, COUNT(s.id) AS sessions, AVG(s.total_score) AS avg_score
       FROM drills d LEFT JOIN sessions s ON s.drill_id = d.id AND s.finished_at IS NOT NULL
       GROUP BY d.id ORDER BY d.level, d.sort_order, d.id`
    ).all();
    return html(adminHome(datasets, drills, url.searchParams.get('note')));
  }

  if (path === '/admin/dataset' && method === 'POST') {
    const { fd, out } = await readForm(request);
    const file = fd.get('file');
    if (!file || typeof file === 'string') return redirect('/admin?note=No file received');

    const { candles, warning } = parseOHLC(await file.text());
    if (!candles.length) return redirect('/admin?note=' + encodeURIComponent(warning || 'Parse failed'));

    const breaks = findBreaks(candles);
    const key = `datasets/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.json`;
    await env.DATA.put(key, JSON.stringify(candles), {
      httpMetadata: { contentType: 'application/json' },
    });
    await env.DB.prepare(
      `INSERT INTO datasets (name, symbol_label, timeframe, decimals, bars, r2_key, breaks)
       VALUES (?,?,?,?,?,?,?)`
    )
      .bind(
        out.name,
        out.symbol_label || null,
        out.timeframe || null,
        Number(out.decimals) || 2,
        candles.length,
        key,
        JSON.stringify(breaks)
      )
      .run();

    const note =
      `Loaded ${candles.length} bars` +
      (breaks.length ? ` · ${breaks.length} discontinuities found and excluded from drills` : '') +
      (warning ? ` — ${warning}` : '');
    return redirect('/admin?note=' + encodeURIComponent(note));
  }

  if (path === '/admin/drill/new' || path.match(/^\/admin\/drill\/\d+$/)) {
    const id = path === '/admin/drill/new' ? null : path.split('/').pop();
    const { results: datasets } = await env.DB.prepare('SELECT * FROM datasets ORDER BY id DESC').all();
    if (!datasets.length) return redirect('/admin?note=Upload a dataset first');

    if (method === 'GET') {
      const drill = id
        ? await env.DB.prepare('SELECT * FROM drills WHERE id = ?').bind(id).first()
        : { dataset_id: url.searchParams.get('dataset') };
      return html(adminDrillForm(datasets, drill));
    }

    const { out } = await readForm(request);
    const dataset = await env.DB.prepare('SELECT * FROM datasets WHERE id = ?')
      .bind(out.dataset_id)
      .first();
    if (!dataset) return html(adminDrillForm(datasets, out, 'Dataset not found.'), 400);

    const start = Math.max(0, Number(out.start_index) || 0);
    const visible = Math.max(20, Number(out.visible_bars) || 90);
    const forward = Math.max(5, Number(out.forward_bars) || 60);

    const obj = await env.DATA.get(dataset.r2_key);
    if (!obj) return html(adminDrillForm(datasets, out, 'Dataset file missing from storage.'), 500);
    const all = JSON.parse(await obj.text());

    if (start + visible + forward > all.length)
      return html(
        adminDrillForm(
          datasets,
          out,
          `That window runs past the end. Dataset has ${all.length} bars; you asked for ${
            start + visible + forward
          }.`
        ),
        400
      );

    const breakSet = new Set(JSON.parse(dataset.breaks || '[]'));
    if (!windowIsContinuous(breakSet, start, start + visible + forward))
      return html(
        adminDrillForm(
          datasets,
          out,
          'That window spans a hole in the data — one candle would jump hundreds of points. Move the start bar.'
        ),
        400
      );

    const window = all.slice(start, start + visible + forward);
    const problem = inspectWindow(window.slice(0, visible));
    if (problem) return html(adminDrillForm(datasets, out, problem), 400);

    const drillATR = computeATR(window.slice(0, visible));
    const key = `drills/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.json`;
    await env.DATA.put(key, JSON.stringify(window), {
      httpMetadata: { contentType: 'application/json' },
    });

    const fields = [
      out.dataset_id,
      out.title,
      out.objective || null,
      Number(out.level) || 1,
      Number(out.sort_order) || 0,
      start,
      visible,
      forward,
      Number(out.max_trades) || 3,
      drillATR,
      dataset.decimals,
      dataset.symbol_label,
      dataset.timeframe,
      key,
      out.status || 'draft',
    ];

    if (id) {
      await env.DB.prepare(
        `UPDATE drills SET dataset_id=?, title=?, objective=?, level=?, sort_order=?, start_index=?,
         visible_bars=?, forward_bars=?, max_trades=?, atr=?, decimals=?, symbol_label=?, timeframe=?,
         r2_key=?, status=? WHERE id=?`
      )
        .bind(...fields, id)
        .run();
    } else {
      await env.DB.prepare(
        `INSERT INTO drills (dataset_id, title, objective, level, sort_order, start_index,
         visible_bars, forward_bars, max_trades, atr, decimals, symbol_label, timeframe, r2_key, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
        .bind(...fields)
        .run();
    }

    return redirect('/admin?note=' + encodeURIComponent(`Drill saved. ATR ${drillATR.toFixed(2)}`));
  }

  const scanMatch = path.match(/^\/admin\/dataset\/(\d+)\/scan$/);
  if (scanMatch) {
    const dataset = await env.DB.prepare('SELECT * FROM datasets WHERE id = ?')
      .bind(scanMatch[1])
      .first();
    if (!dataset) return redirect('/admin?note=Dataset not found');

    const obj = await env.DATA.get(dataset.r2_key);
    if (!obj) return redirect('/admin?note=Dataset file missing');
    const all = JSON.parse(await obj.text());

    if (method === 'POST') {
      const { out } = await readForm(request);
      const start = Number(out.start);
      const visible = Number(out.visible);
      const forward = Number(out.forward);
      const window = all.slice(start, start + visible + forward);
      const drillATR = computeATR(window.slice(0, visible));
      const key = `drills/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.json`;
      await env.DATA.put(key, JSON.stringify(window), {
        httpMetadata: { contentType: 'application/json' },
      });
      await env.DB.prepare(
        `INSERT INTO drills (dataset_id, title, objective, level, sort_order, start_index,
         visible_bars, forward_bars, max_trades, atr, decimals, symbol_label, timeframe,
         structure, bias, r2_key, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft')`
      )
        .bind(
          dataset.id,
          `${STRUCTURE_KN[out.structure] || 'Drill'} — bar ${start}`,
          STRUCTURE_LESSON[out.structure] || null,
          1,
          0,
          start,
          visible,
          forward,
          3,
          drillATR,
          dataset.decimals,
          dataset.symbol_label,
          dataset.timeframe,
          out.structure || null,
          out.bias || null,
          key
        )
        .run();
      return redirect('/admin?note=' + encodeURIComponent('Draft drill created. Edit the title and objective, then set it live.'));
    }

    const structures = url.searchParams.getAll('s');
    const opts = {
      visible: Number(url.searchParams.get('visible')) || 90,
      forward: Number(url.searchParams.get('forward')) || 60,
      minQuality: Number(url.searchParams.get('minq')) || 55,
      structures: structures.length ? structures : Object.keys(STRUCTURE),
    };
    const candidates =
      url.searchParams.has('visible') || structures.length
        ? scanDataset(all, {
            ...opts,
            stride: 5,
            limit: 16,
            breaks: new Set(JSON.parse(dataset.breaks || '[]')),
          })
        : [];
    return html(adminScan(dataset, candidates, opts));
  }

  const sessMatch = path.match(/^\/admin\/drill\/(\d+)\/sessions$/);
  if (sessMatch) {
    const drill = await env.DB.prepare('SELECT * FROM drills WHERE id = ?').bind(sessMatch[1]).first();
    if (!drill) return redirect('/admin');
    const { results } = await env.DB.prepare(
      `SELECT s.*, st.name AS name, st.phone AS phone FROM sessions s
       JOIN students st ON st.id = s.student_id
       WHERE s.drill_id = ? AND s.finished_at IS NOT NULL ORDER BY s.total_score DESC`
    )
      .bind(drill.id)
      .all();
    return html(adminSessions(drill, results));
  }

  return redirect('/admin');
}
