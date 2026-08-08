// Student-facing pages. The replay screen is the product; everything else
// exists to get a trader into it and to show them what they did afterwards.

export const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const num = (v, d = 2) =>
  v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(d);

export const signedR = (v) => (Number(v) > 0 ? '+' : '') + num(v, 2) + 'R';

const CSS = `
:root{
  --ink:#0F1319; --surface:#171C24; --raise:#212832; --line:#2B3340;
  --gold:#D6A93C; --gold-dim:rgba(214,169,60,.13);
  --profit:#4C9A7A; --loss:#C25A4E;
  --text:#ECEDEF; --muted:#8B94A3;
  --mono:"IBM Plex Mono",ui-monospace,monospace;
  --display:"Hubballi","Anek Kannada",system-ui,sans-serif;
  --body:"Anek Kannada","Noto Sans Kannada",system-ui,sans-serif;
  --r:10px;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--ink)}
body{color:var(--text);font-family:var(--body);font-size:16px;line-height:1.6;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.wrap{max-width:640px;margin:0 auto;padding:0 18px 56px}
.wrap-wide{max-width:1120px}
a{color:var(--gold);text-decoration:none}
button{font-family:var(--body)}
:focus-visible{outline:2px solid var(--gold);outline-offset:2px}

.masthead{padding:20px 0 18px;margin-bottom:22px;border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.brand-mark{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--gold);border:1px solid var(--gold);border-radius:3px;padding:3px 7px}
.brand-name{font-size:13.5px;color:var(--muted)}
.masthead h1{font-family:var(--display);font-size:34px;line-height:1.12;margin:14px 0 0;font-weight:400}
.masthead .sub{color:var(--muted);font-size:14.5px;margin-top:8px;max-width:46ch}

.tick{display:flex;align-items:center;gap:12px;margin:32px 0 14px}
.tick::before{content:"";flex:1;height:1px;background:var(--line)}
.tick span{font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;
  color:var(--muted);background:var(--surface);border:1px solid var(--line);
  border-radius:3px;padding:4px 9px;white-space:nowrap}

.card{border:1px solid var(--line);background:var(--surface);border-radius:var(--r);
  padding:16px 17px;margin-bottom:10px;display:block;color:inherit;transition:border-color .15s}
a.card:hover{border-color:var(--gold)}
.card h3{font-family:var(--display);font-size:21px;font-weight:400;margin:0 0 3px;line-height:1.25}
.card .obj{color:var(--muted);font-size:13.5px;line-height:1.5}
.card-row{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}

.pill{display:inline-block;font-family:var(--mono);font-size:10px;letter-spacing:.09em;
  padding:4px 9px;border-radius:20px;border:1px solid var(--line);color:var(--muted);white-space:nowrap}
.pill.done{color:var(--profit);border-color:var(--profit)}
.pill.live{color:var(--gold);border-color:var(--gold);background:var(--gold-dim)}

.field{margin-bottom:14px}
.field label{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--muted);margin-bottom:6px}
input,textarea,select{width:100%;background:var(--ink);border:1px solid var(--line);border-radius:8px;
  padding:12px 13px;color:var(--text);font-size:15px;font-family:var(--body)}
input[type=number],input[type=tel]{font-family:var(--mono);font-size:16px}
input:focus,textarea:focus,select:focus{outline:none;border-color:var(--gold)}
textarea{resize:vertical;min-height:72px;line-height:1.55}
.hint{color:var(--muted);font-size:12.5px;margin-top:6px;line-height:1.5}
.prices{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}

.btn{display:block;width:100%;background:var(--gold);color:#141821;border:0;border-radius:9px;
  padding:15px;font-size:16.5px;font-weight:600;cursor:pointer;text-align:center;font-family:var(--body)}
.btn:hover{filter:brightness(1.08)}
.btn:disabled{opacity:.38;cursor:not-allowed;filter:none}
.btn-ghost{background:transparent;color:var(--gold);border:1px solid var(--line)}
.btn-sm{padding:11px;font-size:14.5px}

.notice{border:1px solid var(--line);border-left:3px solid var(--gold);background:var(--surface);
  border-radius:0 8px 8px 0;padding:13px 15px;font-size:14px;margin:14px 0;line-height:1.55}
.notice.bad{border-left-color:var(--loss)}
.notice.good{border-left-color:var(--profit)}

.board{width:100%;border-collapse:collapse;font-size:14.5px}
.board th{text-align:left;font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--muted);font-weight:400;padding:0 0 9px;border-bottom:1px solid var(--line)}
.board td{padding:12px 0;border-bottom:1px solid var(--line);vertical-align:top}
.board .rank{font-family:var(--mono);color:var(--muted);width:30px}
.board .pts{font-family:var(--mono);text-align:right;color:var(--gold);white-space:nowrap}
.board tr.top .rank{color:var(--gold)}

.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:9px}
.stat{border:1px solid var(--line);border-radius:9px;padding:11px 12px;background:var(--surface)}
.stat .k{font-family:var(--mono);font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}
.stat .v{font-family:var(--mono);font-size:20px;margin-top:4px;line-height:1.1}
.pos{color:var(--profit)} .neg{color:var(--loss)} .warn{color:var(--gold)}

.term{display:grid;grid-template-columns:1fr 312px;gap:16px;align-items:start}
@media (max-width:880px){.term{grid-template-columns:1fr}}
.chartbox{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);overflow:hidden}
#chart{display:block;width:100%;height:420px;position:relative}
@media (max-width:880px){#chart{height:290px}}
.chartbar{display:flex;gap:8px;padding:11px;border-top:1px solid var(--line);flex-wrap:wrap;align-items:center}
.chartbar button{background:var(--raise);border:1px solid var(--line);color:var(--text);
  border-radius:8px;padding:11px 15px;font-size:14.5px;cursor:pointer}
.chartbar button:hover:not(:disabled){border-color:var(--gold)}
.chartbar button:disabled{opacity:.32;cursor:not-allowed}
.chartbar .grow{flex:1}
.chartbar .meta{font-family:var(--mono);font-size:12px;color:var(--muted)}

.panel{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);padding:15px}
.panel h4{margin:0 0 11px;font-size:10px;font-family:var(--mono);letter-spacing:.16em;
  text-transform:uppercase;color:var(--muted);font-weight:400}
.sides{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:13px}
.side{border:1px solid var(--line);background:var(--ink);border-radius:8px;padding:12px;
  text-align:center;cursor:pointer;font-family:var(--mono);font-size:14px;letter-spacing:.08em}
.side input{position:absolute;opacity:0;pointer-events:none}
.side[data-s=BUY]{color:var(--profit)} .side[data-s=SELL]{color:var(--loss)}
.side:has(input:checked){background:var(--raise);border-color:currentColor}

.ruler{margin:14px 0 4px}
.ruler-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:9px}
.ruler-head .lab{font-family:var(--mono);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.ruler-head .now{font-family:var(--mono);font-size:17px}
.track{position:relative;height:30px;border:1px solid var(--line);border-radius:6px;
  background:var(--ink);overflow:hidden}
.zone{position:absolute;top:0;bottom:0}
.zone-risk{background:rgba(194,90,78,.20)}
.zone-reward{background:rgba(76,154,122,.18)}
.stake{position:absolute;top:0;bottom:0;width:1px}
.stake.sl{background:var(--loss)} .stake.e{background:var(--gold)} .stake.tp{background:var(--profit)}
.stake b{position:absolute;top:50%;transform:translate(-50%,-50%);font-family:var(--mono);
  font-size:9px;letter-spacing:.08em;background:var(--ink);padding:1px 4px;border-radius:2px}
.stake.sl b{color:var(--loss)} .stake.e b{color:var(--gold)} .stake.tp b{color:var(--profit)}
.cursor{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--text);border-radius:1px}
.ruler-foot{font-size:12px;color:var(--muted);margin-top:8px;line-height:1.5;min-height:2.6em}

.rr-line{display:flex;justify-content:space-between;font-family:var(--mono);font-size:13px;
  padding:10px 0;border-top:1px solid var(--line)}

.trade{border-top:1px solid var(--line);padding:11px 0;font-size:13.5px}
.trade .top{display:flex;justify-content:space-between;font-family:var(--mono);font-size:12.5px;gap:10px}
.trade .note{color:var(--muted);font-size:12.5px;margin-top:4px;line-height:1.5}

.curve{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);padding:14px}
.curve svg{display:block;width:100%;height:130px}

.lede{border:1px solid var(--line);background:var(--surface);border-radius:var(--r);padding:18px;margin-bottom:6px}
.lede p{margin:0 0 12px;font-size:14.5px;line-height:1.65;color:var(--muted)}
.lede p b{color:var(--text);font-weight:500}
.lede-r{border-top:1px solid var(--line);padding-top:13px;margin-bottom:0!important}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}
@media (max-width:520px){.steps{grid-template-columns:repeat(2,1fr)}}
.step{border:1px solid var(--line);border-radius:8px;padding:10px 8px;text-align:center;background:var(--ink)}
.step b{display:block;font-family:var(--mono);font-size:15px;color:var(--gold);font-weight:400}
.step span{display:block;font-size:12px;color:var(--muted);margin-top:4px;line-height:1.35}

.card.locked{opacity:.42}
.card.locked h3{color:var(--muted)}

.finding{border:1px solid var(--line);border-left:3px solid var(--muted);background:var(--surface);
  border-radius:0 9px 9px 0;padding:13px 15px;margin-bottom:9px}
.finding.fix{border-left-color:var(--loss)}
.finding.watch{border-left-color:var(--gold)}
.finding.strength{border-left-color:var(--profit)}
.finding-head{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
.finding-head b{font-family:var(--display);font-size:19px;font-weight:400}
.finding-head .sev{font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.finding.fix .sev{color:var(--loss)} .finding.watch .sev{color:var(--gold)} .finding.strength .sev{color:var(--profit)}
.finding-body{font-size:13.5px;line-height:1.6;color:var(--muted);margin-top:5px}

.foot{margin-top:42px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);
  font-size:12.5px;line-height:1.7}
.nav{display:flex;gap:18px;margin-top:13px;font-size:13.5px;flex-wrap:wrap}
.foot a{color:var(--muted);text-decoration:underline}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

export function layout(title, body, { wide = false, nav = true, script = '' } = {}) {
  return `<!doctype html><html lang="kn"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0F1319">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hubballi&family=Anek+Kannada:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head><body><div class="wrap${wide ? ' wrap-wide' : ''}">${body}
<div class="foot">
  <div>ಇದು ಶೈಕ್ಷಣಿಕ ಅಭ್ಯಾಸ ಸಾಧನ. ಹಿಂದಿನ ಮಾರುಕಟ್ಟೆ ದತ್ತಾಂಶದ ಮೇಲೆ ಅಭ್ಯಾಸ ಮಾಡುವುದು ಮುಂದಿನ ಫಲಿತಾಂಶದ ಸೂಚನೆ ಅಲ್ಲ.
  ಇಲ್ಲಿ ಯಾವುದೇ buy/sell ಸಲಹೆ ಅಥವಾ ಲಾಭದ ಭರವಸೆ ನೀಡುವುದಿಲ್ಲ.</div>
  ${nav ? `<div class="nav"><a href="/">ಡ್ರಿಲ್‌ಗಳು</a><a href="/leaderboard">ಅಂಕಪಟ್ಟಿ</a><a href="/me">ನನ್ನ ದಾಖಲೆ</a></div>` : ''}
  <div style="margin-top:12px">Quest Capital Institute · 7019991009 · www.questcapital.in</div>
  <div style="margin-top:8px">ಚಾರ್ಟ್‌ಗಳು Lightweight Charts™ ಮೂಲಕ — ರಚಿಸಿದವರು
    <a href="https://www.tradingview.com/" rel="noopener" target="_blank">TradingView, Inc.</a></div>
</div></div>${script}</body></html>`;
}

const head = (h1, sub, eyebrow = 'Trade Lab') => `<div class="masthead">
  <div class="brand"><span class="brand-mark">${esc(eyebrow)}</span><span class="brand-name">ಟ್ರೇಡಿಂಗ್ ಕನ್ನಡದಲ್ಲಿ</span></div>
  <h1>${esc(h1)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>`;

export const tick = (l) => `<div class="tick"><span>${esc(l)}</span></div>`;

const LEVEL_KN = {
  1: 'ಹಂತ 1 — ಪ್ರವೃತ್ತಿ ಗುರುತಿಸುವಿಕೆ',
  2: 'ಹಂತ 2 — ಪ್ರವೇಶ ಮತ್ತು ಸ್ಟಾಪ್',
  3: 'ಹಂತ 3 — ಅಪಾಯ ನಿರ್ವಹಣೆ',
  4: 'ಹಂತ 4 — ಸೆಷನ್ ಮತ್ತು ಸುದ್ದಿ',
  5: 'ಹಂತ 5 — ಮುಕ್ತ ಅಭ್ಯಾಸ',
};

/* ------------------------------------------------------------------ home */

export function homePage(byLevel, done, unlocked = {}) {
  const levels = Object.keys(byLevel).sort((a, b) => a - b);

  const intro = `<div class="lede">
    <p>ಪ್ರತಿ ಡ್ರಿಲ್‌ನಲ್ಲಿ ನಿಜವಾದ ಚಾರ್ಟ್‌ನ ಒಂದು ತುಂಡು ಸಿಗುತ್ತೆ. ಬಲಗಡೆ ಮುಚ್ಚಿರುತ್ತೆ.
    ನೀವು ದಿಕ್ಕು ನಿರ್ಧರಿಸಿ, Entry–SL–TP ಇಡಿ, ಕಾರಣ ಬರೆಯಿರಿ. ಆಮೇಲೆ ಕ್ಯಾಂಡಲ್ ಒಂದೊಂದಾಗಿ ತೆರೆಯುತ್ತೆ.</p>
    <p><b>ಮುಂದೇನಾಗುತ್ತೆ ಅನ್ನೋದು ನಿಮಗೂ ಗೊತ್ತಿಲ್ಲ, ಬ್ರೌಸರ್‌ಗೂ ಗೊತ್ತಿಲ್ಲ.</b>
    ಕ್ಯಾಂಡಲ್‌ಗಳು ಸರ್ವರ್‌ನಲ್ಲಿ ಇರುತ್ತವೆ, ಒಂದೊಂದಾಗಿ ಮಾತ್ರ ಬರುತ್ತವೆ.</p>
    <div class="steps">
      <div class="step"><b>1</b><span>ಚಾರ್ಟ್ ಓದಿ</span></div>
      <div class="step"><b>2</b><span>ಆರ್ಡರ್ ಇಡಿ</span></div>
      <div class="step"><b>3</b><span>ಕ್ಯಾಂಡಲ್ ತೆರೆಯಿರಿ</span></div>
      <div class="step"><b>4</b><span>ವರದಿ ಓದಿ</span></div>
    </div>
    <p class="lede-r">ಎಲ್ಲಾ ಲೆಕ್ಕ <b>R</b> ನಲ್ಲಿ — ರೂಪಾಯಿಯಲ್ಲಿ ಅಲ್ಲ. ನಿಮ್ಮ ಸ್ಟಾಪ್ ಎಂದರೆ 1R.
    ಅದೇ ಅಳತೆಗೋಲು. ಆಗ ಎಷ್ಟು ಲಾಟ್ ಅನ್ನೋ ಪ್ರಶ್ನೆ ಹೋಗಿ, ಎಷ್ಟು ಅಪಾಯ ಅನ್ನೋ ಪ್ರಶ್ನೆ ಬರುತ್ತೆ.</p>
  </div>`;

  const body = levels.length
    ? levels
        .map((lv) => {
          const open = unlocked[lv] !== false;
          const cards = byLevel[lv]
            .map((d) => {
              const s = done[d.id];
              const badge = s
                ? `<span class="pill done">${s.total_score} / 100</span>`
                : `<span class="pill">${d.forward_bars} bars</span>`;
              const inner = `<div class="card-row"><div>
                  <h3>${esc(d.title)}</h3>
                  <div class="obj">${esc(d.objective || '')}</div>
                </div>${badge}</div>`;
              return open
                ? `<a class="card" href="/drill/${d.id}">${inner}</a>`
                : `<div class="card locked">${inner}</div>`;
            })
            .join('');
          return (
            tick((LEVEL_KN[lv] || `ಹಂತ ${lv}`) + (open ? '' : ' · ಬೀಗ')) +
            (open
              ? ''
              : `<div class="hint" style="margin:-4px 0 12px">ಹಿಂದಿನ ಹಂತದ ಎರಡು ಡ್ರಿಲ್ 60 ಅಂಕದ ಮೇಲೆ ಮುಗಿಸಿದರೆ ಇದು ತೆರೆಯುತ್ತೆ.</div>`) +
            cards
          );
        })
        .join('')
    : `<div class="notice">ಇನ್ನೂ ಯಾವುದೇ ಡ್ರಿಲ್ ಪ್ರಕಟವಾಗಿಲ್ಲ.</div>`;

  return layout(
    'QCI Trade Lab',
    head(
      'ನಿಜವಾದ ಚಾರ್ಟ್. ಒಂದೊಂದೇ ಕ್ಯಾಂಡಲ್.',
      'ಹಿಂದಿನ ಮಾರುಕಟ್ಟೆಯನ್ನು ಮತ್ತೆ ಓಡಿಸಿ ಅಭ್ಯಾಸ ಮಾಡಿ — ಸಂಪೂರ್ಣ ಕನ್ನಡದಲ್ಲಿ.'
    ) +
      intro +
      body
  );
}

/* ---------------------------------------------------------------- replay */

export function replayPage(drill, student) {
  const d = drill.decimals ?? 2;
  return layout(
    drill.title,
    head(drill.title, drill.objective || '', `Level ${drill.level}`) +
      `<div class="term">
      <div>
        <div class="chartbox">
          <div id="chart"></div>
          <div class="chartbar">
            <button type="button" id="bNext">ಮುಂದಿನ ಕ್ಯಾಂಡಲ್ →</button>
            <button type="button" id="bPlay">▶ ಆಟೋ</button>
            <span class="grow"></span>
            <span class="meta" id="mLeft"></span>
          </div>
        </div>
        <div id="msg"></div>
        <div id="trades"></div>
      </div>

      <div class="panel">
        <h4>ಆರ್ಡರ್</h4>
        <div class="sides">
          <label class="side" data-s="BUY"><input type="radio" name="side" value="BUY" checked>BUY</label>
          <label class="side" data-s="SELL"><input type="radio" name="side" value="SELL">SELL</label>
        </div>
        <div class="prices">
          <div class="field"><label for="entry">Entry</label><input type="number" step="any" id="entry" inputmode="decimal"></div>
          <div class="field"><label for="sl">SL</label><input type="number" step="any" id="sl" inputmode="decimal"></div>
          <div class="field"><label for="tp">TP</label><input type="number" step="any" id="tp" inputmode="decimal"></div>
        </div>
        <div class="ruler">
          <div class="ruler-head"><span class="lab">R ಅಳತೆ</span><span class="now" id="rNow">—</span></div>
          <div class="track" id="track">
            <div class="zone zone-risk" id="zRisk" hidden></div>
            <div class="zone zone-reward" id="zRew" hidden></div>
            <div class="stake sl" id="kSl" hidden><b>&minus;1R</b></div>
            <div class="stake e" id="kE" hidden><b>0</b></div>
            <div class="stake tp" id="kTp" hidden><b id="kTpL"></b></div>
            <div class="cursor" id="cur" hidden></div>
          </div>
          <div class="ruler-foot" id="rFoot">ನಿಮ್ಮ ಸ್ಟಾಪ್ ಎಂದರೆ 1R. ಎಲ್ಲವನ್ನೂ ಅದರ ಪಟ್ಟುಗಳಲ್ಲಿ ಅಳೆಯಿರಿ.</div>
        </div>
        <div class="rr-line"><span>ಉಳಿದ ಆರ್ಡರ್</span><span id="left">${drill.max_trades}</span></div>
        <div class="field" style="margin-top:8px"><label for="note">ಈ ಟ್ರೇಡ್ ಯಾಕೆ?</label>
          <textarea id="note" maxlength="300" placeholder="ಕಾರಣ ಬರೆದರೆ ಮಾತ್ರ journal ಅಂಕ ಸಿಗುತ್ತೆ"></textarea></div>
        <button class="btn btn-sm" type="button" id="bPlace">ಆರ್ಡರ್ ಇಡಿ</button>
        <button class="btn btn-sm btn-ghost" style="margin-top:8px" type="button" id="bClose" disabled>ಈಗಿನ ಟ್ರೇಡ್ ಮುಚ್ಚಿ</button>
        <button class="btn btn-sm btn-ghost" style="margin-top:8px" type="button" id="bFinish">ಸೆಷನ್ ಮುಗಿಸಿ</button>
        <div class="hint">ಒಂದು ಸಮಯದಲ್ಲಿ ಒಂದೇ ಟ್ರೇಡ್. ಚಾರ್ಟ್ ಮೇಲೆ ಟ್ಯಾಪ್ ಮಾಡಿದರೆ ಆ ಬೆಲೆ ಆಯ್ಕೆಯಾದ ಖಾನೆಗೆ ಬರುತ್ತೆ.</div>
      </div>
    </div>`,
    {
      wide: true,
      script: `<script src="/lwc.js"></script>
<script src="/static/chart.js"></script>
<script>
window.DRILL = ${JSON.stringify({
        id: drill.id,
        decimals: d,
        maxTrades: drill.max_trades,
        student: student.name,
      })};
</script>
<script src="/static/replay.js"></script>`,
    }
  );
}

/* --------------------------------------------------------------- results */

const STATUS_KN = {
  TP: 'ಟಾರ್ಗೆಟ್ ಹಿಟ್',
  SL: 'ಸ್ಟಾಪ್ ಹಿಟ್',
  CLOSED: 'ಕೈಯಿಂದ ಮುಚ್ಚಿದ್ದು',
  EXPIRED: 'ಸೆಷನ್ ಕೊನೆಗೆ ಮುಚ್ಚಿತು',
  CANCELLED: 'ಫಿಲ್ ಆಗಲಿಲ್ಲ',
  OPEN: 'ಓಪನ್',
  PENDING: 'ಕಾಯುತ್ತಿದೆ',
};


/** Cumulative R after each trade, drawn server-side so the report needs no JS. */
function rCurve(trades) {
  const points = [0];
  let running = 0;
  for (const t of trades) {
    running += t.realisedR ?? 0;
    points.push(running);
  }
  if (points.length < 2) return '';

  const W = 600, H = 130, pad = 16;
  const hi = Math.max(...points, 0.5);
  const lo = Math.min(...points, -0.5);
  const x = (i) => pad + (i / (points.length - 1)) * (W - pad * 2);
  const y = (v) => pad + ((hi - v) / (hi - lo)) * (H - pad * 2);

  const path = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const end = points[points.length - 1];
  const stroke = end > 0 ? 'var(--profit)' : end < 0 ? 'var(--loss)' : 'var(--muted)';
  const dots = points
    .slice(1)
    .map(
      (v, i) =>
        `<circle cx="${x(i + 1).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5" fill="${
          (trades[i]?.realisedR ?? 0) >= 0 ? 'var(--profit)' : 'var(--loss)'
        }"/>`
    )
    .join('');

  return `<div class="curve"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
    aria-label="ಸೆಷನ್‌ನ ಸಂಚಿತ R ರೇಖೆ">
    <line x1="${pad}" y1="${y(0).toFixed(1)}" x2="${W - pad}" y2="${y(0).toFixed(1)}"
      stroke="var(--line)" stroke-width="1"/>
    <path d="${path}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
    ${dots}
  </svg></div>`;
}

export function resultPage(drill, session, stats, score, trades, rank) {
  const d = drill.decimals ?? 2;
  const cls = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

  const stat = (k, v, c = '') => `<div class="stat"><div class="k">${esc(k)}</div><div class="v ${c}">${v}</div></div>`;

  const tradeRows = trades
    .map((t, i) => {
      const r = t.realisedR ?? 0;
      return `<div class="trade">
      <div class="top"><span>${i + 1}. ${esc(t.side)} @ ${num(t.entry, d)}</span>
        <span class="${cls(r)}">${signedR(r)}</span></div>
      <div class="top" style="color:var(--muted)"><span>SL ${num(t.sl, d)} · TP ${num(t.tp, d)} · 1:${num(
        t.plannedRR,
        2
      )}</span><span>${esc(STATUS_KN[t.status] || t.status)}</span></div>
      ${t.note ? `<div class="note">${esc(t.note)}</div>` : `<div class="note">ಕಾರಣ ಬರೆದಿಲ್ಲ</div>`}
    </div>`;
    })
    .join('');

  const verdict =
    score.total >= 80
      ? ['ಶಿಸ್ತುಬದ್ಧ ಸೆಷನ್.', 'good']
      : score.total >= 55
      ? ['ಸರಿಯಾದ ದಿಕ್ಕಿನಲ್ಲಿದೆ. ಯೋಜನೆ ಇನ್ನೂ ಬಿಗಿಯಾಗಬೇಕು.', '']
      : ['ಫಲಿತಾಂಶಕ್ಕಿಂತ ಪ್ರಕ್ರಿಯೆ ಮೊದಲು ಸರಿಪಡಿಸಿ.', 'bad'];

  return layout(
    drill.title + ' — ಫಲಿತಾಂಶ',
    head(drill.title, 'ಸೆಷನ್ ಮುಗಿದಿದೆ', 'Session Report') +
      `<div class="notice ${verdict[1]}">${esc(verdict[0])}</div>` +
      tick('ಅಂಕ') +
      `<div class="stats">
        ${stat('ಒಟ್ಟು', score.total + ' / 100', 'warn')}
        ${stat('ಫಲಿತಾಂಶ', score.result + ' / 40')}
        ${stat('ಯೋಜನೆ', score.planning + ' / 25')}
        ${stat('ಅಪಾಯ', score.risk + ' / 20')}
        ${stat('ಜರ್ನಲ್', score.journal + ' / 15')}
      </div>
      <div class="hint">ಫಲಿತಾಂಶ 100 ರಲ್ಲಿ 40 ಮಾತ್ರ. ಚೆನ್ನಾಗಿ ಯೋಜಿಸಿ ಸೋತ ಟ್ರೇಡ್, ಯೋಜನೆ ಇಲ್ಲದೆ ಗೆದ್ದ ಟ್ರೇಡ್‌ಗಿಂತ ಹೆಚ್ಚು ಅಂಕ ಪಡೆಯುತ್ತೆ.</div>` +
      (trades.length ? tick('R ರೇಖೆ') + rCurve(trades) : '') +
      tick('ಅಂಕಿಅಂಶ') +
      `<div class="stats">
        ${stat('ಒಟ್ಟು R', signedR(stats.totalR), cls(stats.totalR))}
        ${stat('ಟ್ರೇಡ್', stats.filled)}
        ${stat('ಗೆಲುವು %', stats.winRate + '%')}
        ${stat('ನಿರೀಕ್ಷಿತ R', signedR(stats.expectancy), cls(stats.expectancy))}
        ${stat('ಗರಿಷ್ಠ ಇಳಿತ', num(stats.maxDrawdownR, 2) + 'R', stats.maxDrawdownR > 0 ? 'neg' : '')}
        ${stat('ಸರಾಸರಿ ಯೋಜಿತ R:R', '1:' + num(stats.avgPlannedRR, 2))}
      </div>` +
      (rank ? `<div class="hint" style="margin-top:12px">ಈ ಡ್ರಿಲ್‌ನಲ್ಲಿ ನಿಮ್ಮ ಸ್ಥಾನ: ${rank.pos} / ${rank.total}</div>` : '') +
      tick('ನಿಮ್ಮ ಟ್ರೇಡ್‌ಗಳು') +
      (tradeRows || `<div class="hint">ಈ ಸೆಷನ್‌ನಲ್ಲಿ ಒಂದೂ ಆರ್ಡರ್ ಇಡಲಿಲ್ಲ.</div>`) +
      `<div style="margin-top:24px"><a class="btn btn-ghost" href="/">ಬೇರೆ ಡ್ರಿಲ್ ಮಾಡಿ</a></div>`
  );
}

/* ------------------------------------------------------------------ misc */

export function startPage(drill, error) {
  return layout(
    drill.title,
    head(drill.title, drill.objective || '', `Level ${drill.level}`) +
      `<div class="card">
        <div class="obj">ಈ ಡ್ರಿಲ್‌ನಲ್ಲಿ ${drill.visible_bars} ಕ್ಯಾಂಡಲ್ ಮೊದಲೇ ಕಾಣಿಸುತ್ತೆ, ನಂತರ ${drill.forward_bars} ಕ್ಯಾಂಡಲ್ ಒಂದೊಂದಾಗಿ ತೆರೆದುಕೊಳ್ಳುತ್ತೆ.
        ಗರಿಷ್ಠ ${drill.max_trades} ಆರ್ಡರ್. ಒಂದು ಬಾರಿ ಶುರು ಮಾಡಿದ ಮೇಲೆ ಮತ್ತೆ ಶುರು ಮಾಡಲು ಆಗಲ್ಲ.</div>
      </div>` +
      (error ? `<div class="notice bad">${esc(error)}</div>` : '') +
      `<form method="post" action="/drill/${drill.id}/start">
        <div class="field"><label for="name">ಹೆಸರು</label><input type="text" id="name" name="name" required maxlength="60"></div>
        <div class="field"><label for="phone">WhatsApp ನಂಬರ್</label><input type="tel" id="phone" name="phone" required inputmode="numeric" placeholder="9876543210"></div>
        <button class="btn" type="submit">ಡ್ರಿಲ್ ಶುರು ಮಾಡಿ</button>
      </form>`
  );
}

export function leaderboardPage(rows) {
  return layout(
    'ಅಂಕಪಟ್ಟಿ',
    head('ಅಂಕಪಟ್ಟಿ', 'ಎಲ್ಲಾ ಡ್ರಿಲ್‌ಗಳ ಸರಾಸರಿ ಅಂಕದ ಆಧಾರದ ಮೇಲೆ.', 'Leaderboard') +
      (rows.length
        ? `<table class="board"><thead><tr><th></th><th>ಹೆಸರು</th><th style="text-align:right">ಡ್ರಿಲ್</th><th style="text-align:right">ಸರಾಸರಿ</th></tr></thead><tbody>
        ${rows
          .map(
            (r, i) => `<tr class="${i < 3 ? 'top' : ''}"><td class="rank">${i + 1}</td>
          <td>${esc(r.name)}<div class="hint" style="margin:0">${esc(r.masked)}</div></td>
          <td class="pts" style="color:var(--muted)">${r.drills}</td>
          <td class="pts">${Math.round(r.avg)}</td></tr>`
          )
          .join('')}</tbody></table>`
        : `<div class="hint">ಇನ್ನೂ ಯಾವುದೇ ಸೆಷನ್ ಮುಗಿದಿಲ್ಲ.</div>`) +
      `<div class="hint" style="margin-top:14px">ಕನಿಷ್ಠ ಮೂರು ಡ್ರಿಲ್ ಮುಗಿಸಿದವರು ಮಾತ್ರ ಇಲ್ಲಿ ಕಾಣಿಸ್ತಾರೆ — ಒಂದೇ ಅದೃಷ್ಟದ ಸೆಷನ್ ಮೇಲಕ್ಕೆ ತರಬಾರದು ಅಂತ.</div>`
  );
}

const SEV_KN = { fix: 'ಸರಿಪಡಿಸಿ', watch: 'ಗಮನಿಸಿ', strength: 'ಬಲ' };

export function mePage({ phone, student, rows, agg, habits, error }) {
  const cls = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
  const stat = (k, v, c = '') => `<div class="stat"><div class="k">${esc(k)}</div><div class="v ${c}">${v}</div></div>`;

  let body = `<form method="get" action="/me">
    <div class="field"><label for="p">WhatsApp ನಂಬರ್</label>
      <input type="tel" id="p" name="phone" value="${esc(phone || '')}" placeholder="9876543210" inputmode="numeric" required></div>
    <button class="btn" type="submit">ನನ್ನ ದಾಖಲೆ ನೋಡಿ</button></form>`;

  if (error) body += `<div class="notice bad">${esc(error)}</div>`;

  if (student) {
    body +=
      tick(student.name) +
      `<div class="stats">
        ${stat('ಡ್ರಿಲ್', agg.drills)}
        ${stat('ಸರಾಸರಿ ಅಂಕ', Math.round(agg.avgScore), 'warn')}
        ${stat('ಒಟ್ಟು R', signedR(agg.totalR), cls(agg.totalR))}
        ${stat('ಟ್ರೇಡ್', agg.trades)}
        ${stat('ಗೆಲುವು %', agg.winRate + '%')}
        ${stat('ನಿರೀಕ್ಷಿತ R', signedR(agg.expectancy), cls(agg.expectancy))}
      </div>` +
      (habits
        ? tick('ನಿಮ್ಮ ಅಭ್ಯಾಸಗಳು') +
          (habits.ready
            ? habits.findings
                .map(
                  (f) => `<div class="finding ${esc(f.severity)}">
                <div class="finding-head"><span class="sev">${esc(SEV_KN[f.severity] || '')}</span>
                <b>${esc(f.title)}</b></div>
                <div class="finding-body">${esc(f.detail)}</div></div>`
                )
                .join('') +
              `<div class="hint">ಇವು ${habits.trades} ಟ್ರೇಡ್‌ಗಳ ಮೇಲೆ ಆಧರಿಸಿವೆ. ಒಂದು ಟ್ರೇಡ್ ಬಗ್ಗೆ ಇಲ್ಲಿ ಏನೂ ಹೇಳುವುದಿಲ್ಲ — ಪುನರಾವರ್ತನೆ ಆಗುವ ಅಭ್ಯಾಸ ಮಾತ್ರ.</div>`
            : `<div class="notice">ಇನ್ನೂ ${habits.needed} ಟ್ರೇಡ್ ಆದ ಮೇಲೆ ನಿಮ್ಮ ಅಭ್ಯಾಸಗಳನ್ನು ಇಲ್ಲಿ ತೋರಿಸ್ತೀವಿ. ಅಷ್ಟು ಇಲ್ಲದೆ ಹೇಳಿದ್ದು ಊಹೆ ಆಗುತ್ತೆ.</div>`)
        : '') +
      tick('ಸೆಷನ್ ಇತಿಹಾಸ') +
      (rows.length
        ? `<table class="board"><thead><tr><th>ಡ್ರಿಲ್</th><th style="text-align:right">R</th><th style="text-align:right">ಅಂಕ</th></tr></thead><tbody>
        ${rows
          .map(
            (r) => `<tr><td><a href="/drill/${r.drill_id}/result">${esc(r.title)}</a></td>
          <td class="pts ${cls(r.total_r)}">${signedR(r.total_r)}</td>
          <td class="pts">${r.total_score}</td></tr>`
          )
          .join('')}</tbody></table>`
        : `<div class="hint">ಇನ್ನೂ ಯಾವುದೇ ಸೆಷನ್ ಮುಗಿದಿಲ್ಲ.</div>`);
  }

  return layout('ನನ್ನ ದಾಖಲೆ', head('ನನ್ನ ದಾಖಲೆ', 'ಎಲ್ಲಾ ಸೆಷನ್‌ಗಳ ಒಟ್ಟು ಅಂಕಿಅಂಶ.', 'Track Record') + body);
}

export function messagePage(title, message, { kind = '', link = '/', linkText = 'ಡ್ರಿಲ್‌ಗಳಿಗೆ' } = {}) {
  return layout(
    title,
    head(title, '') + `<div class="notice ${kind}">${esc(message)}</div>
    <a class="btn btn-ghost" href="${esc(link)}">${esc(linkText)}</a>`
  );
}
