import { layout, tick, esc, num } from './ui.js';
import { STRUCTURE, STRUCTURE_KN, STRUCTURE_LESSON } from './scan.js';

export function adminLogin(error) {
  return layout(
    'Mentor',
    `<div class="masthead"><div class="brand"><span class="brand-mark">Mentor</span></div><h1>Trade Lab admin</h1></div>
     ${error ? `<div class="notice bad">${esc(error)}</div>` : ''}
     <form method="post" action="/admin/login">
       <div class="field"><label for="k">Admin key</label><input type="text" id="k" name="key" required autocomplete="current-password"></div>
       <button class="btn" type="submit">Sign in</button></form>`,
    { nav: false }
  );
}

export function adminHome(datasets, drills, note) {
  const dsRows = datasets.length
    ? datasets
        .map(
          (d) => `<tr><td>${esc(d.name)}
        <div class="hint" style="margin:0">${esc(d.symbol_label || '—')} · ${esc(d.timeframe || '')} · ${d.bars} bars · ${d.decimals} dp</div></td>
        <td class="pts" style="white-space:nowrap">
          <a href="/admin/dataset/${d.id}/scan">Find windows</a> ·
          <a href="/admin/drill/new?dataset=${d.id}">Manual</a></td></tr>`
        )
        .join('')
    : `<tr><td colspan="2" class="hint">No datasets yet. Upload a CSV to begin.</td></tr>`;

  const drillRows = drills.length
    ? drills
        .map(
          (d) => `<tr><td><a href="/admin/drill/${d.id}">${esc(d.title)}</a>
        <div class="hint" style="margin:0">L${d.level} · ${esc(d.status)} · ${d.visible_bars}+${d.forward_bars} bars · ${d.sessions} sessions${
            d.avg_score != null ? ` · avg ${Math.round(d.avg_score)}` : ''
          }</div></td>
        <td class="pts"><a href="/admin/drill/${d.id}/sessions">Sessions</a></td></tr>`
        )
        .join('')
    : `<tr><td colspan="2" class="hint">No drills yet.</td></tr>`;

  return layout(
    'Mentor',
    `<div class="masthead"><div class="brand"><span class="brand-mark">Mentor</span><span class="brand-name">Trade Lab</span></div><h1>Workbench</h1></div>
     ${note ? `<div class="notice good">${esc(note)}</div>` : ''}
     ${tick('Upload market data')}
     <form method="post" action="/admin/dataset" enctype="multipart/form-data">
       <div class="field"><label for="name">Internal name</label><input type="text" id="name" name="name" required placeholder="XAUUSD 15M 2023 H1"></div>
       <div class="prices">
         <div class="field"><label for="symbol_label">Shown to students</label><input type="text" id="symbol_label" name="symbol_label" placeholder="Metal A"></div>
         <div class="field"><label for="timeframe">Timeframe</label><input type="text" id="timeframe" name="timeframe" placeholder="15M"></div>
         <div class="field"><label for="decimals">Decimals</label><input type="number" id="decimals" name="decimals" value="2" min="0" max="6"></div>
       </div>
       <div class="field"><label for="file">CSV export</label><input type="file" id="file" name="file" accept=".csv,.txt,text/csv" required></div>
       <div class="hint">MT5 "Export bars" (tab separated) and comma exports both work. Give students a neutral symbol label so the chart cannot be looked up.</div>
       <button class="btn" style="margin-top:10px" type="submit">Upload dataset</button>
     </form>
     ${tick('Datasets')}<table class="board"><tbody>${dsRows}</tbody></table>
     ${tick('Drills')}<table class="board"><tbody>${drillRows}</tbody></table>
     <div style="margin-top:24px"><a class="btn btn-ghost" href="/admin/logout">Sign out</a></div>`,
    { nav: false }
  );
}

export function adminDrillForm(datasets, drill, error, preview) {
  const isNew = !drill?.id;
  const v = (k, d = '') => esc(drill?.[k] ?? d);
  const sel = (k, val) => (String(drill?.[k]) === String(val) ? 'selected' : '');

  return layout(
    isNew ? 'New drill' : 'Edit drill',
    `<div class="masthead"><div class="brand"><span class="brand-mark">Drill</span></div>
      <h1>${isNew ? 'New drill' : esc(drill.title)}</h1></div>
     ${error ? `<div class="notice bad">${esc(error)}</div>` : ''}
     ${preview ? `<div class="notice good">${esc(preview)}</div>` : ''}
     <form method="post" action="/admin/drill/${isNew ? 'new' : drill.id}">
       <div class="field"><label for="dataset_id">Dataset</label>
         <select id="dataset_id" name="dataset_id" required>
           ${datasets
             .map(
               (d) =>
                 `<option value="${d.id}" ${sel('dataset_id', d.id)}>${esc(d.name)} — ${d.bars} bars</option>`
             )
             .join('')}
         </select></div>

       <div class="field"><label for="title">Title (Kannada)</label>
         <input type="text" id="title" name="title" required value="${v('title')}" placeholder="Trend ದಿಕ್ಕಿನಲ್ಲಿ ಮಾತ್ರ"></div>

       <div class="field"><label for="objective">The one lesson this drill teaches</label>
         <input type="text" id="objective" name="objective" value="${v('objective')}"
           placeholder="Trend ಗೆ ವಿರುದ್ಧ trade ಮಾಡಬೇಡಿ"></div>

       <div class="prices">
         <div class="field"><label for="level">Level</label>
           <select id="level" name="level">${[1, 2, 3, 4, 5]
             .map((n) => `<option value="${n}" ${sel('level', n)}>${n}</option>`)
             .join('')}</select></div>
         <div class="field"><label for="sort_order">Order</label>
           <input type="number" id="sort_order" name="sort_order" value="${v('sort_order', 0)}"></div>
         <div class="field"><label for="max_trades">Max orders</label>
           <input type="number" id="max_trades" name="max_trades" value="${v('max_trades', 3)}" min="1" max="20"></div>
       </div>

       ${tick('Window')}
       <div class="prices">
         <div class="field"><label for="start_index">Start bar</label>
           <input type="number" id="start_index" name="start_index" required value="${v('start_index', 0)}" min="0"></div>
         <div class="field"><label for="visible_bars">Visible</label>
           <input type="number" id="visible_bars" name="visible_bars" value="${v('visible_bars', 90)}" min="20" max="400"></div>
         <div class="field"><label for="forward_bars">Forward</label>
           <input type="number" id="forward_bars" name="forward_bars" value="${v('forward_bars', 60)}" min="5" max="400"></div>
       </div>
       <div class="hint">The student sees the visible bars at once, then reveals the forward bars one at a time. ATR is measured from the visible window when you save.</div>

       <div class="field"><label for="status">Status</label>
         <select id="status" name="status">
           <option value="draft" ${sel('status', 'draft')}>draft — hidden</option>
           <option value="live" ${sel('status', 'live')}>live — students can run it</option>
           <option value="retired" ${sel('status', 'retired')}>retired</option>
         </select></div>

       <button class="btn" type="submit">${isNew ? 'Create drill' : 'Save'}</button>
     </form>
     <div style="margin-top:18px"><a class="btn btn-ghost" href="/admin">Back</a></div>`,
    { nav: false }
  );
}

export function adminSessions(drill, rows) {
  const body = rows.length
    ? rows
        .map((r) => {
          const stats = r.stats ? JSON.parse(r.stats) : {};
          const score = r.score ? JSON.parse(r.score) : {};
          const trades = r.trades ? JSON.parse(r.trades) : [];
          return `<div class="card">
        <div class="card-row"><div>
          <h3>${esc(r.name)}</h3>
          <div class="obj">${esc(r.phone)} · ${trades.length} orders · ${stats.winRate ?? 0}% win · ${
            stats.totalR > 0 ? '+' : ''
          }${num(stats.totalR, 2)}R</div>
        </div><span class="pill live">${r.total_score ?? '—'} / 100</span></div>
        <div class="hint" style="margin-top:8px">result ${score.result ?? 0} · planning ${
            score.planning ?? 0
          } · risk ${score.risk ?? 0} · journal ${score.journal ?? 0}</div>
        ${trades
          .filter((t) => t.note)
          .map((t) => `<div class="trade"><div class="note">${esc(t.side)}: ${esc(t.note)}</div></div>`)
          .join('')}
      </div>`;
        })
        .join('')
    : `<div class="hint">No completed sessions yet.</div>`;

  return layout(
    'Sessions · ' + drill.title,
    `<div class="masthead"><div class="brand"><span class="brand-mark">Sessions</span></div>
      <h1>${esc(drill.title)}</h1><div class="sub">${rows.length} completed</div></div>${body}
     <div style="margin-top:20px"><a class="btn btn-ghost" href="/admin">Back</a></div>`,
    { nav: false }
  );
}


/* ------------------------------------------------------- window scanner */

export function adminScan(dataset, candidates, opts) {
  const checked = (k) => (opts.structures.includes(k) ? 'checked' : '');

  const cards = candidates.length
    ? candidates
        .map(
          (c) => `<div class="card">
      <div class="card-row"><div>
        <h3>${esc(STRUCTURE_KN[c.structure])}</h3>
        <div class="obj">${esc(c.detail)}</div>
        <div class="hint" style="margin-top:5px">bar ${c.start}–${c.start + c.visible + c.forward} · ATR ${num(
            c.atr,
            2
          )} · ${esc(STRUCTURE_LESSON[c.structure])}</div>
      </div><span class="pill live">${c.quality}</span></div>
      <form method="post" action="/admin/dataset/${dataset.id}/scan" style="margin-top:10px">
        <input type="hidden" name="start" value="${c.start}">
        <input type="hidden" name="visible" value="${c.visible}">
        <input type="hidden" name="forward" value="${c.forward}">
        <input type="hidden" name="structure" value="${esc(c.structure)}">
        <input type="hidden" name="bias" value="${esc(c.direction)}">
        <button class="btn btn-sm btn-ghost" type="submit">Create draft drill</button>
      </form>
    </div>`
        )
        .join('')
    : `<div class="notice">Nothing matched at this quality threshold. Widen the structures or lower the bar.</div>`;

  return layout(
    'Find windows',
    `<div class="masthead"><div class="brand"><span class="brand-mark">Scanner</span></div>
      <h1>${esc(dataset.name)}</h1>
      <div class="sub">${dataset.bars} bars. The scanner proposes windows; you decide which ones teach something.</div></div>

     <form method="get" action="/admin/dataset/${dataset.id}/scan">
       <div class="field"><label>Structures to look for</label>
         <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
         ${Object.keys(STRUCTURE)
           .map(
             (k) => `<label class="side" style="text-align:left;font-family:var(--kn);font-size:13.5px">
             <input type="checkbox" name="s" value="${k}" ${checked(k)} style="width:auto;margin-right:7px">
             ${esc(STRUCTURE_KN[k])}</label>`
           )
           .join('')}
         </div></div>
       <div class="prices">
         <div class="field"><label for="visible">Visible bars</label>
           <input type="number" id="visible" name="visible" value="${opts.visible}" min="30" max="300"></div>
         <div class="field"><label for="forward">Forward bars</label>
           <input type="number" id="forward" name="forward" value="${opts.forward}" min="20" max="300"></div>
         <div class="field"><label for="minq">Min quality</label>
           <input type="number" id="minq" name="minq" value="${opts.minQuality}" min="0" max="100"></div>
       </div>
       <button class="btn" type="submit">Scan</button>
     </form>
     ${tick(`${candidates.length} candidates`)}
     ${cards}
     <div style="margin-top:20px"><a class="btn btn-ghost" href="/admin">Back</a></div>`,
    { nav: false }
  );
}
