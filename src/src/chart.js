// Chart rendering.
//
// Lightweight Charts™ by TradingView does the drawing when it is available:
// proper crosshair, price scale, pinch-zoom and touch handling that a hand
// rolled canvas renderer would take months to match. It is vendored into this
// Worker rather than pulled from a CDN, because a student in Hubballi on a
// weak connection should never get a page with no chart on it.
//
// The bundled canvas renderer below stays as a fallback for the case where the
// library fails to evaluate at all. A drill with a plain chart is worth far
// more than a drill with an error message.
//
// Attribution: Lightweight Charts™ is Apache 2.0 licensed and created by
// TradingView, Inc. The library's own attribution logo is left enabled and the
// footer links to https://www.tradingview.com/ — both are licence conditions.
//
// One deliberate choice: the time axis is hidden and bar times are synthetic
// sequential values. Real timestamps on the axis would tell a student exactly
// which day they are looking at, and the whole drill collapses the moment
// someone can go and check what happened next.

export const REPLAY_JS = String.raw`
(function () {
  'use strict';

  function css(v, fallback) {
    var x = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    return x || fallback;
  }

  /* ------------------------------------------------ Lightweight Charts */

  function LWChart(container) {
    var LC = window.LightweightCharts;
    this.el = container;
    this.candles = [];
    this.visible = 0;
    this.decimals = 2;
    this.levels = [];
    this.marks = [];
    this._lines = [];

    this.chart = LC.createChart(container, {
      layout: {
        background: { type: 'solid', color: css('--surface', '#171C24') },
        textColor: css('--muted', '#8B94A3'),
        fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
        fontSize: 11,
        attributionLogo: true
      },
      grid: {
        vertLines: { color: css('--line', '#2B3340'), style: 1 },
        horzLines: { color: css('--line', '#2B3340'), style: 1 }
      },
      rightPriceScale: {
        borderColor: css('--line', '#2B3340'),
        scaleMargins: { top: 0.12, bottom: 0.12 }
      },
      // Hiding the time axis is what keeps the drill honest.
      timeScale: { visible: false, borderVisible: false },
      crosshair: {
        mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0,
        vertLine: { color: css('--muted', '#8B94A3'), width: 1, style: 2, labelVisible: false },
        horzLine: { color: css('--muted', '#8B94A3'), width: 1, style: 2, labelBackgroundColor: css('--raise', '#212832') }
      },
      handleScale: { axisPressedMouseMove: { time: false } },
      autoSize: true
    });

    var opts = {
      upColor: css('--profit', '#4C9A7A'),
      downColor: css('--loss', '#C25A4E'),
      borderUpColor: css('--profit', '#4C9A7A'),
      borderDownColor: css('--loss', '#C25A4E'),
      wickUpColor: css('--profit', '#4C9A7A'),
      wickDownColor: css('--loss', '#C25A4E'),
      priceLineVisible: false,
      lastValueVisible: true
    };

    // v5 moved series creation behind addSeries; v4 had a method per type.
    this.series = this.chart.addSeries
      ? this.chart.addSeries(LC.CandlestickSeries, opts)
      : this.chart.addCandlestickSeries(opts);

    this._markerApi = null;
  }

  LWChart.prototype.setData = function (candles, decimals) {
    this.candles = candles;
    this.decimals = decimals == null ? 2 : decimals;
    this.series.applyOptions({
      priceFormat: { type: 'price', precision: this.decimals, minMove: Math.pow(10, -this.decimals) }
    });
  };

  LWChart.prototype._bars = function () {
    var out = [];
    var n = Math.min(this.visible, this.candles.length);
    for (var i = 0; i < n; i++) {
      var c = this.candles[i];
      // Synthetic, evenly spaced times. Meaningless on purpose.
      out.push({ time: 946684800 + i * 900, open: c.o, high: c.h, low: c.l, close: c.c });
    }
    return out;
  };

  LWChart.prototype.draw = function () {
    if (!this.candles.length) return;
    this.series.setData(this._bars());

    var self = this;
    this._lines.forEach(function (l) { try { self.series.removePriceLine(l); } catch (e) {} });
    this._lines = this.levels.filter(function (lv) { return isFinite(lv.price); }).map(function (lv) {
      return self.series.createPriceLine({
        price: lv.price,
        color: lv.color,
        lineWidth: 1,
        lineStyle: lv.dash && lv.dash.length ? 2 : 0,
        axisLabelVisible: true,
        title: lv.label || ''
      });
    });

    var markers = this.marks.map(function (m) {
      return {
        time: 946684800 + m.index * 900,
        position: m.kind === 'exit' ? 'inBar' : (m.side === 'BUY' ? 'belowBar' : 'aboveBar'),
        color: m.kind === 'exit' ? css('--muted', '#8B94A3')
          : (m.side === 'BUY' ? css('--profit', '#4C9A7A') : css('--loss', '#C25A4E')),
        shape: m.kind === 'exit' ? 'circle' : (m.side === 'BUY' ? 'arrowUp' : 'arrowDown')
      };
    }).sort(function (a, b) { return a.time - b.time; });

    if (this.series.setMarkers) {
      this.series.setMarkers(markers);
    } else if (window.LightweightCharts.createSeriesMarkers) {
      if (!this._markerApi) {
        this._markerApi = window.LightweightCharts.createSeriesMarkers(this.series, markers);
      } else {
        this._markerApi.setMarkers(markers);
      }
    }

    if (!this._scrolled) { this.chart.timeScale().fitContent(); }
    else { this.chart.timeScale().scrollToRealTime(); }
    this._scrolled = true;
  };

  LWChart.prototype.priceAt = function (clientY) {
    var rect = this.el.getBoundingClientRect();
    var p = this.series.coordinateToPrice(clientY - rect.top);
    return p == null ? null : p;
  };

  /* ---------------------------------------------- canvas fallback ---- */

(function () {
  'use strict';

  var css = getComputedStyle(document.documentElement);
  var COL = {
    up:   css.getPropertyValue('--profit').trim()  || '#4E9A6E',
    down: css.getPropertyValue('--loss').trim()    || '#B4574E',
    grid: css.getPropertyValue('--line').trim()    || '#2C3A4E',
    text: css.getPropertyValue('--muted').trim()   || '#8494A9',
    gold: css.getPropertyValue('--gold').trim()    || '#C9A227',
    ink:  css.getPropertyValue('--ink').trim()     || '#0E1420'
  };

  var PAD = { top: 14, right: 62, bottom: 22, left: 6 };

  function Chart(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.candles = [];
    this.visible = 0;      // how many bars are revealed
    this.window = 90;      // how many bars fit on screen
    this.levels = [];      // [{price, color, label, dash}]
    this.decimals = 2;
    this.marks = [];       // [{index, price, side, kind}]
    var self = this;
    window.addEventListener('resize', function () { self.draw(); });
  }

  Chart.prototype.setData = function (candles, decimals) {
    this.candles = candles;
    this.decimals = decimals == null ? 2 : decimals;
  };

  Chart.prototype.slice = function () {
    var end = this.visible;
    var start = Math.max(0, end - this.window);
    return { start: start, end: end, bars: this.candles.slice(start, end) };
  };

  Chart.prototype.bounds = function (bars) {
    var hi = -Infinity, lo = Infinity;
    for (var i = 0; i < bars.length; i++) {
      if (bars[i].h > hi) hi = bars[i].h;
      if (bars[i].l < lo) lo = bars[i].l;
    }
    for (var j = 0; j < this.levels.length; j++) {
      var p = this.levels[j].price;
      if (isFinite(p)) { hi = Math.max(hi, p); lo = Math.min(lo, p); }
    }
    if (!isFinite(hi) || !isFinite(lo)) { hi = 1; lo = 0; }
    var pad = (hi - lo) * 0.08 || 1;
    return { hi: hi + pad, lo: lo - pad };
  };

  Chart.prototype.draw = function () {
    var cv = this.cv, ctx = this.ctx;
    var ratio = window.devicePixelRatio || 1;
    var w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w * ratio || cv.height !== h * ratio) {
      cv.width = w * ratio; cv.height = h * ratio;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var sl = this.slice();
    var bars = sl.bars;
    if (!bars.length) return;

    var b = this.bounds(bars);
    var plotW = w - PAD.left - PAD.right;
    var plotH = h - PAD.top - PAD.bottom;
    var self = this;
    var y = function (price) { return PAD.top + ((b.hi - price) / (b.hi - b.lo)) * plotH; };
    var step = plotW / this.window;
    var x = function (i) { return PAD.left + (i + 0.5) * step; };
    this._y = y; this._x = x; this._slice = sl; this._b = b;

    // horizontal grid + price axis
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = COL.grid;
    ctx.fillStyle = COL.text;
    ctx.lineWidth = 1;
    var ticks = 5;
    for (var t = 0; t <= ticks; t++) {
      var price = b.lo + ((b.hi - b.lo) * t) / ticks;
      var py = Math.round(y(price)) + 0.5;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(PAD.left, py); ctx.lineTo(w - PAD.right, py); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillText(price.toFixed(this.decimals), w - PAD.right + 7, py);
    }

    // candles
    var bw = Math.max(1, Math.min(11, step * 0.62));
    for (var i = 0; i < bars.length; i++) {
      var c = bars[i];
      var cx = Math.round(x(i)) + 0.5;
      var up = c.c >= c.o;
      ctx.strokeStyle = up ? COL.up : COL.down;
      ctx.fillStyle = up ? COL.up : COL.down;
      ctx.beginPath(); ctx.moveTo(cx, y(c.h)); ctx.lineTo(cx, y(c.l)); ctx.stroke();
      var top = y(Math.max(c.o, c.c));
      var bot = y(Math.min(c.o, c.c));
      ctx.fillRect(cx - bw / 2, top, bw, Math.max(1, bot - top));
    }

    // order levels
    for (var k = 0; k < this.levels.length; k++) {
      var lv = this.levels[k];
      if (!isFinite(lv.price)) continue;
      var ly = Math.round(y(lv.price)) + 0.5;
      ctx.strokeStyle = lv.color;
      ctx.setLineDash(lv.dash || []);
      ctx.beginPath(); ctx.moveTo(PAD.left, ly); ctx.lineTo(w - PAD.right, ly); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = lv.color;
      ctx.fillRect(w - PAD.right + 2, ly - 8, PAD.right - 4, 16);
      ctx.fillStyle = COL.ink;
      ctx.fillText(lv.price.toFixed(this.decimals), w - PAD.right + 6, ly);
      if (lv.label) {
        ctx.fillStyle = lv.color;
        ctx.fillText(lv.label, PAD.left + 4, ly - 11);
      }
    }

    // entry / exit markers
    for (var m = 0; m < this.marks.length; m++) {
      var mk = this.marks[m];
      var rel = mk.index - sl.start;
      if (rel < 0 || rel >= bars.length) continue;
      var mx = x(rel), my = y(mk.price);
      ctx.fillStyle = mk.kind === 'exit' ? COL.text : (mk.side === 'BUY' ? COL.up : COL.down);
      ctx.beginPath();
      if (mk.kind === 'exit') {
        ctx.arc(mx, my, 3.2, 0, Math.PI * 2);
      } else if (mk.side === 'BUY') {
        ctx.moveTo(mx, my - 7); ctx.lineTo(mx - 5, my + 3); ctx.lineTo(mx + 5, my + 3);
      } else {
        ctx.moveTo(mx, my + 7); ctx.lineTo(mx - 5, my - 3); ctx.lineTo(mx + 5, my - 3);
      }
      ctx.closePath(); ctx.fill();
    }

    // last price tag
    var last = bars[bars.length - 1];
    var ly2 = Math.round(y(last.c)) + 0.5;
    ctx.fillStyle = COL.gold;
    ctx.fillRect(w - PAD.right + 2, ly2 - 8, PAD.right - 4, 16);
    ctx.fillStyle = COL.ink;
    ctx.fillText(last.c.toFixed(this.decimals), w - PAD.right + 6, ly2);

    // bar counter
    ctx.fillStyle = COL.text;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(this.visible + ' / ' + this.candles.length + ' bars', PAD.left + 4, h - 7);
    ctx.textBaseline = 'middle';
  };

  /** Price under a pointer, so a student can tap the chart to set a level. */
  Chart.prototype.priceAt = function (clientY) {
    if (!this._b) return null;
    var rect = this.cv.getBoundingClientRect();
    var h = this.cv.clientHeight;
    var plotH = h - PAD.top - PAD.bottom;
    var rel = clientY - rect.top - PAD.top;
    rel = Math.max(0, Math.min(plotH, rel));
    return this._b.hi - (rel / plotH) * (this._b.hi - this._b.lo);
  };

  window.QCICanvasChart = Chart;
})();


  /* ------------------------------------------------------- selection */

  window.QCIChart = function (container) {
    var el = container;
    if (window.LightweightCharts && window.LightweightCharts.createChart) {
      try {
        return new LWChart(el);
      } catch (e) {
        if (window.console) console.warn('Lightweight Charts failed, falling back', e);
      }
    }
    // The fallback needs a canvas; the page gives us a div.
    if (el.tagName !== 'CANVAS') {
      var cv = document.createElement('canvas');
      cv.style.display = 'block';
      cv.style.width = '100%';
      cv.style.height = el.clientHeight ? el.clientHeight + 'px' : '400px';
      el.appendChild(cv);
      el = cv;
    }
    return new window.QCICanvasChart(el);
  };
})();
`;
