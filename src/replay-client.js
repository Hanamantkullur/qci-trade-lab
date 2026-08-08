// The replay controller. Every candle comes from the server, one request at a
// time, so nothing about the future is ever sitting in the page for a curious
// student to read out of devtools.

export const CLIENT_JS = String.raw`
(function () {
  'use strict';
  var D = window.DRILL;
  var chart = window.QCIChart(document.getElementById('chart'));
  var state = { candles: [], trades: [], left: D.maxTrades, done: false, busy: false };
  var playing = null;

  var $ = function (id) { return document.getElementById(id); };
  var elEntry = $('entry'), elSl = $('sl'), elTp = $('tp'), elNote = $('note');
  var elLeft = $('left'), elMsg = $('msg'), elTrades = $('trades'), elMeta = $('mLeft');
  var elRNow = $('rNow'), elRFoot = $('rFoot');
  var zRisk = $('zRisk'), zRew = $('zRew');
  var kSl = $('kSl'), kE = $('kE'), kTp = $('kTp'), kTpL = $('kTpL'), cur = $('cur');
  var lastClose = null;
  var bNext = $('bNext'), bPlay = $('bPlay'), bPlace = $('bPlace'), bClose = $('bClose'), bFinish = $('bFinish');
  var lastFocused = elEntry;

  [elEntry, elSl, elTp].forEach(function (el) {
    el.addEventListener('focus', function () { lastFocused = el; });
  });

  function side() {
    var c = document.querySelector('input[name=side]:checked');
    return c ? c.value : 'BUY';
  }

  function say(text, kind) {
    elMsg.innerHTML = text ? '<div class="notice ' + (kind || '') + '">' + text + '</div>' : '';
  }

  function post(path, body) {
    state.busy = true; sync();
    return fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json(); }).then(function (j) {
      state.busy = false;
      if (j.error) say(j.error, 'bad');
      return j;
    }).catch(function () {
      state.busy = false;
      say('ಸಂಪರ್ಕ ತೊಂದರೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', 'bad');
      return { error: true };
    });
  }

  function levels() {
    var out = [];
    var open = state.trades.filter(function (t) {
      return t.status === 'OPEN' || t.status === 'PENDING';
    })[0];
    if (open) {
      out.push({ price: open.entry, color: getCss('--gold'), label: 'ENTRY', dash: [5, 4] });
      out.push({ price: open.sl, color: getCss('--loss'), label: 'SL' });
      out.push({ price: open.tp, color: getCss('--profit'), label: 'TP' });
      return out;
    }
    var e = parseFloat(elEntry.value), s = parseFloat(elSl.value), t = parseFloat(elTp.value);
    if (isFinite(e)) out.push({ price: e, color: getCss('--gold'), label: 'ENTRY', dash: [5, 4] });
    if (isFinite(s)) out.push({ price: s, color: getCss('--loss'), label: 'SL', dash: [3, 4] });
    if (isFinite(t)) out.push({ price: t, color: getCss('--profit'), label: 'TP', dash: [3, 4] });
    return out;
  }

  function getCss(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function marks() {
    var out = [];
    state.trades.forEach(function (t) {
      if (t.filledAt != null) out.push({ index: t.filledAt, price: t.entry, side: t.side, kind: 'entry' });
      if (t.exitIndex != null) out.push({ index: t.exitIndex, price: t.exitPrice, kind: 'exit' });
    });
    return out;
  }

  /**
   * The R-ruler. Everything is drawn in multiples of the distance from entry to
   * stop, so a student reads their trade the way the scoring reads it: the stop
   * is always exactly one unit away, whatever the instrument or the lot size.
   */
  function drawRuler() {
    var open = live();
    var e, s, t, side_;
    if (open) { e = open.entry; s = open.sl; t = open.tp; side_ = open.side; }
    else {
      e = parseFloat(elEntry.value); s = parseFloat(elSl.value); t = parseFloat(elTp.value);
      side_ = side();
    }

    var parts = [zRisk, zRew, kSl, kE, kTp, cur];
    var risk = Math.abs(e - s);
    var ok = [e, s, t].every(isFinite) && risk > 0 &&
      (side_ === 'BUY' ? (s < e && e < t) : (t < e && e < s));

    if (!ok) {
      parts.forEach(function (el) { el.hidden = true; });
      elRNow.textContent = '—'; elRNow.className = 'now';
      elRFoot.textContent = [e, s, t].every(isFinite)
        ? (side_ === 'BUY' ? 'Buy ಗೆ SL ಕೆಳಗೆ, TP ಮೇಲೆ ಇರಬೇಕು.' : 'Sell ಗೆ SL ಮೇಲೆ, TP ಕೆಳಗೆ ಇರಬೇಕು.')
        : 'ನಿಮ್ಮ ಸ್ಟಾಪ್ ಎಂದರೆ 1R. ಎಲ್ಲವನ್ನೂ ಅದರ ಪಟ್ಟುಗಳಲ್ಲಿ ಅಳೆಯಿರಿ.';
      return;
    }

    var rrPlan = Math.abs(t - e) / risk;
    var nowR = null;
    if (open && open.status === 'OPEN' && lastClose != null) {
      nowR = (side_ === 'BUY' ? lastClose - e : e - lastClose) / risk;
    }

    var lo = -1.4;
    var hi = Math.max(rrPlan, nowR == null ? 0 : nowR, 1) + 0.5;
    var pos = function (r) { return ((r - lo) / (hi - lo)) * 100; };

    parts.forEach(function (el) { el.hidden = false; });
    zRisk.style.left = pos(-1) + '%'; zRisk.style.width = (pos(0) - pos(-1)) + '%';
    zRew.style.left = pos(0) + '%'; zRew.style.width = (pos(rrPlan) - pos(0)) + '%';
    kSl.style.left = pos(-1) + '%';
    kE.style.left = pos(0) + '%';
    kTp.style.left = pos(rrPlan) + '%';
    kTpL.textContent = '+' + rrPlan.toFixed(1) + 'R';

    if (nowR == null) { cur.hidden = true; } else { cur.style.left = pos(nowR) + '%'; }

    if (nowR != null) {
      elRNow.textContent = (nowR > 0 ? '+' : '') + nowR.toFixed(2) + 'R';
      elRNow.className = 'now ' + (nowR > 0 ? 'pos' : nowR < 0 ? 'neg' : '');
      elRFoot.textContent = 'ಈಗ ನೀವು ' + (nowR >= 0 ? 'ಲಾಭದಲ್ಲಿ' : 'ನಷ್ಟದಲ್ಲಿ') + ' ಇದ್ದೀರಿ. ಗುರಿ +' +
        rrPlan.toFixed(1) + 'R, ಸ್ಟಾಪ್ −1R.';
    } else {
      elRNow.textContent = '1 : ' + rrPlan.toFixed(2);
      elRNow.className = 'now ' + (rrPlan > 8 ? 'neg' : rrPlan >= 2 ? 'pos' : rrPlan >= 1 ? 'warn' : 'neg');
      elRFoot.textContent = rrPlan > 8
        ? 'ಸ್ಟಾಪ್ ತುಂಬಾ ಹತ್ತಿರ. ಇಷ್ಟು ಬಿಗಿಯಾದ ಸ್ಟಾಪ್ ಸಾಮಾನ್ಯವಾಗಿ ಮೊದಲೇ ಹಿಟ್ ಆಗುತ್ತೆ.'
        : rrPlan >= 2 ? 'ಒಳ್ಳೆಯ ಅನುಪಾತ. ಅರ್ಧ ಟ್ರೇಡ್ ತಪ್ಪಾದರೂ ಲಾಭ ಉಳಿಯುತ್ತೆ.'
        : rrPlan >= 1 ? 'ಸಾಧಾರಣ. ಗೆಲುವಿನ ಪ್ರಮಾಣ ಹೆಚ್ಚಿರಬೇಕಾಗುತ್ತೆ.'
        : 'ಅಪಾಯ ಲಾಭಕ್ಕಿಂತ ಹೆಚ್ಚು. ಗುರಿ ದೂರ ಇಡಿ ಅಥವಾ ಸ್ಟಾಪ್ ಹತ್ತಿರ ತನ್ನಿ.';
    }
  }

  function renderTrades() {
    if (!state.trades.length) { elTrades.innerHTML = ''; return; }
    var names = { TP: 'ಟಾರ್ಗೆಟ್ ಹಿಟ್', SL: 'ಸ್ಟಾಪ್ ಹಿಟ್', OPEN: 'ಓಪನ್', PENDING: 'ಕಾಯುತ್ತಿದೆ',
                  CLOSED: 'ಮುಚ್ಚಿದೆ', EXPIRED: 'ಅವಧಿ ಮುಗಿಯಿತು', CANCELLED: 'ಫಿಲ್ ಆಗಲಿಲ್ಲ' };
    elTrades.innerHTML = state.trades.map(function (t, i) {
      var r = t.realisedR;
      var cls = r > 0 ? 'pos' : r < 0 ? 'neg' : '';
      return '<div class="trade"><div class="top">' +
        '<span>' + (i + 1) + '. ' + t.side + ' @ ' + t.entry.toFixed(D.decimals) + '</span>' +
        '<span class="' + cls + '">' + (r == null ? names[t.status] : (r > 0 ? '+' : '') + r.toFixed(2) + 'R') + '</span>' +
        '</div><div class="top" style="color:var(--muted)"><span>SL ' + t.sl.toFixed(D.decimals) +
        ' · TP ' + t.tp.toFixed(D.decimals) + '</span><span>' + names[t.status] + '</span></div></div>';
    }).join('');
  }

  function sync() {
    chart.levels = levels();
    chart.marks = marks();
    chart.draw();
    drawRuler();
    renderTrades();
    elLeft.textContent = state.left;
    var hasOpen = state.trades.some(function (t) { return t.status === 'OPEN'; });
    bClose.disabled = !hasOpen || state.done || state.busy;
    bPlace.disabled = state.left <= 0 || state.done || state.busy ||
      state.trades.some(function (t) { return t.status === 'OPEN' || t.status === 'PENDING'; });
    bNext.disabled = state.done || state.busy;
    bPlay.disabled = state.done || state.busy;
    elMeta.textContent = state.remaining != null ? state.remaining + ' ಕ್ಯಾಂಡಲ್ ಬಾಕಿ' : '';
  }

  function apply(j) {
    if (j.candles && j.candles.length) {
      state.candles = state.candles.concat(j.candles);
      chart.setData(state.candles, D.decimals);
      chart.visible = state.candles.length;
      lastClose = state.candles[state.candles.length - 1].c;
    }
    if (j.trades) state.trades = j.trades;
    if (j.left != null) state.left = j.left;
    if (j.remaining != null) state.remaining = j.remaining;
    if (j.finished) { state.done = true; stopPlay(); say('ಸೆಷನ್ ಮುಗಿಯಿತು. ಫಲಿತಾಂಶಕ್ಕೆ ಕರೆದೊಯ್ಯುತ್ತಿದ್ದೇವೆ…'); location.href = '/drill/' + D.id + '/result'; }
    sync();
  }

  function next() {
    if (state.done || state.busy) return Promise.resolve();
    return post('/api/session/next', {}).then(function (j) { if (!j.error) apply(j); });
  }

  function stopPlay() {
    if (playing) { clearInterval(playing); playing = null; bPlay.textContent = '▶ ಆಟೋ'; }
  }

  bNext.addEventListener('click', function () { stopPlay(); next(); });
  bPlay.addEventListener('click', function () {
    if (playing) return stopPlay();
    bPlay.textContent = '❚❚ ನಿಲ್ಲಿಸಿ';
    playing = setInterval(function () { if (!state.busy) next(); }, 900);
  });

  bPlace.addEventListener('click', function () {
    stopPlay();
    post('/api/session/order', {
      side: side(),
      entry: parseFloat(elEntry.value),
      sl: parseFloat(elSl.value),
      tp: parseFloat(elTp.value),
      note: elNote.value
    }).then(function (j) {
      if (j.error) return;
      say('ಆರ್ಡರ್ ಇಡಲಾಗಿದೆ.', 'good');
      elNote.value = '';
      apply(j);
    });
  });

  bClose.addEventListener('click', function () {
    stopPlay();
    post('/api/session/close', {}).then(function (j) { if (!j.error) { say('ಟ್ರೇಡ್ ಮುಚ್ಚಲಾಗಿದೆ.'); apply(j); } });
  });

  bFinish.addEventListener('click', function () {
    if (!confirm('ಸೆಷನ್ ಮುಗಿಸಬೇಕಾ? ಮತ್ತೆ ಶುರು ಮಾಡಲು ಆಗಲ್ಲ.')) return;
    stopPlay();
    post('/api/session/finish', {}).then(function (j) { if (!j.error) apply(j); });
  });

  // Tap the chart to drop a price into whichever box was last touched.
  document.getElementById('chart').addEventListener('click', function (ev) {
    var p = chart.priceAt(ev.clientY);
    if (p == null) return;
    lastFocused.value = p.toFixed(D.decimals);
    sync();
  });

  ['input', 'change'].forEach(function (e) {
    document.querySelector('.panel').addEventListener(e, sync);
  });

  // Boot: the server hands back whatever this student had already revealed.
  post('/api/session/state', {}).then(function (j) {
    if (j.error) return;
    apply(j);
    if (!state.candles.length) return say('ದತ್ತಾಂಶ ಬರಲಿಲ್ಲ. ಪುಟ ರಿಫ್ರೆಶ್ ಮಾಡಿ.', 'bad');
    if (!elEntry.value && lastClose != null) {
      var step = Math.max(Math.abs(lastClose) * 0.0015, Math.pow(10, -D.decimals) * 10);
      elEntry.value = lastClose.toFixed(D.decimals);
      elSl.value = (lastClose - step).toFixed(D.decimals);
      elTp.value = (lastClose + step * 2).toFixed(D.decimals);
      sync();
    }
  });
})();
`;
