# QCI Trade Lab

A Kannada chart-replay trainer. A student sees a real historical chart, reveals
it one candle at a time, places orders with a stop and a target, and finds out
what the market actually did — without ever being able to see ahead.

Cloudflare Worker + D1 + R2. No build step, no framework, no monthly bill at the
volumes an institute runs.

---

## Charts

Rendering is TradingView's **Lightweight Charts™ v5.2.0** — proper crosshair,
price scale, pinch-zoom and touch handling that a hand-rolled canvas renderer
would take months to match.

The library is **vendored into `public/lwc.js` and served from the Worker**, not
pulled from a CDN. A student in Hubballi on a weak connection should never get a
page where the chart silently failed to load. The bundled canvas renderer stays
in `src/chart.js` as a fallback if the library fails to evaluate at all — a
drill with a plain chart is worth far more than a drill with an error message.

**Licence.** Lightweight Charts™ is Apache 2.0 and free for commercial use, but
the licence requires naming TradingView as the creator with a visible link. Two
things satisfy this and both are already in place: the library's own attribution
logo is left enabled on the chart, and every page footer credits
TradingView, Inc. with a link. Do not remove either. `public/lwc-LICENSE.txt`
carries the full licence text.

**The time axis is hidden and bar times are synthetic.** Real timestamps on the
axis would tell a student exactly which day they are looking at, and the drill
collapses the moment someone can go and check what happened next.

## The design

Dark navy and gold, matching the QCI document system. Display type is
**Hubballi**, a Kannada face named after the city this institute was built in;
**Anek Kannada** carries the reading; every number is **IBM Plex Mono**, because
a price should look like a price.

The signature element is the **R-ruler** in the order panel. It pins the stop at
−1R, the entry at 0, and the target wherever the planned ratio puts it, then
slides a marker along as candles reveal. The platform's whole argument is that a
trader should think in R rather than rupees — the ruler makes that argument
visible instead of leaving it in a disclaimer. The session report closes the loop
with an R-curve: cumulative R after each trade, drawn server-side as SVG so the
report needs no JavaScript at all.

## Why the replay is server-driven

The obvious way to build this is to send the whole window to the browser and let
JavaScript reveal it bar by bar. Do that and any student who opens devtools can
read the next fifty candles out of memory in about ten seconds, and the moment
one of them posts a screenshot in the group, every score on the platform is
worthless.

So the server holds the candles. Each press of **ಮುಂದಿನ ಕ್ಯಾಂಡಲ್** is a request
that returns exactly one new bar and steps any live order against it. Order
validation, fills, stop and target hits, and scoring all happen on the Worker.
The browser draws pictures and nothing else.

The test suite checks this directly: a 150-bar drill window must never put more
than the 90 visible bars into the page.

---

## What the platform scores

Result is deliberately capped at 40 of 100. A beginner who takes two
well-planned trades and loses both should outscore someone who fired twelve
unplanned orders into a trend and got lucky, because over a year the first
student will be the better trader.

| Component | Points | Measures |
|---|---|---|
| Result | 40 | Total R, scaled against a +3R target and floored at zero |
| Planning | 25 | Share of orders with a planned R:R between 1:1.5 and 1:8 |
| Risk | 20 | Stops at least half an ATR wide, and staying inside the order limit |
| Journal | 15 | Share of orders with a written reason |

Everything is denominated in **R**, never rupees. A student who thinks in R
stops asking how many lots and starts asking how much of the account is at risk,
which is the whole lesson.

Guardrails built into the engine:

- A stop closer than a quarter ATR is rejected outright at order time.
- A planned R:R above 1:8 scores as a weak plan, not an excellent one — that
  ratio almost always means the stop was squeezed against the entry.
- When a bar spans both stop and target, the stop wins. Every honest backtester
  makes the same assumption.
- An order that never fills is worth 0R, not a loss. Patience should not be
  punished the way a bad entry is.
- One open position at a time. This is a constraint, not a limitation — it is
  what the drill is teaching.

---

## Getting market data

You need real OHLC candles. Images will not do.

**Use your own MT5 terminal.** Tools → Quotes → select symbol and timeframe →
Export bars. You get a tab-separated file the uploader reads directly. This is
your broker's feed and you are entitled to it.

**Do not scrape TradingView.** Their terms prohibit redistributing their data,
and a platform serving students across India is redistribution however you frame
it. Free alternatives whose licences do permit this include HistData and
Dukascopy for forex — read their terms before you rely on them.

**Relabel the symbol.** Set the student-facing label to something like "Metal A"
so nobody can identify the instrument and go look up what happened. Combined
with hidden dates, this closes the last obvious cheat.

---

## Setup

The D1 database and R2 bucket already exist in your Cloudflare account, and the
database id is already filled into `wrangler.toml`. Three commands remain:

```bash
cd qci-trade-lab
npm install
npx wrangler login

npm run db:remote                    # create the tables
npx wrangler secret put ADMIN_KEY    # your admin password, a long random string
npm run deploy
```

Already provisioned:

| Resource | Name | Notes |
|---|---|---|
| D1 | `qci-trade-lab` | `d4a26ee8-cf86-4ec1-a1a2-132909cb53c7`, APAC region |
| R2 | `qci-trade-lab-data` | created in ENAM — the API gives no location choice. If upload latency from India bothers you, recreate it from the dashboard with an APAC hint and update `wrangler.toml`. |

Locally:

```bash
npm run db:local
npx wrangler dev --local --var ADMIN_KEY:testkey
```

---

## Data continuity — read this before uploading

Real broker exports have holes. A missing week shows up as one candle leaping
hundreds of points, and any lesson a student draws from that candle is false.

So every upload is checked. A break is recorded wherever the series skips more
than 96 hours, or where price dislocates more than 1.5% from one bar's close to
the next bar's open. The scanner never proposes a window that spans a break, and
manual drill creation refuses one.

Slice large files before uploading. Twenty-odd thousand bars — about one year of
15-minute data — parses in under two seconds and scans in under a second. A
multi-year file works but makes every scan slower for no benefit, and the slices
also let you cut cleanly around any holes you find.

The `xau-slices` folder holds XAUUSD 15-minute data from 2021 onward, already
cut around the two gaps in the source file: 2021, 2022, 2023, 2024,
2025 Jan–Sep 12, and 2025 Oct–2026 Jan 13. That is 116,736 bars, and every slice
is clean except 2022, which contains one bad tick the guard already excludes.

## Finding drill windows

Twenty thousand real bars is roughly two hundred hours of chart if you scroll it
by hand, and that scrolling — not the code — is what would actually stop this
platform from growing. So the scanner reads a dataset once and proposes windows
classified by the lesson they teach.

`/admin` → **Find windows** on any dataset. Four detectors, all mechanical and
explainable — none of them predicts anything, they measure what already happened:

| Structure | Fires when | Teaches |
|---|---|---|
| ಸ್ಪಷ್ಟ ಪ್ರವೃತ್ತಿ | 3+ ATR net move with high path efficiency | Trade with the trend |
| ಚಲನೆ ಇಲ್ಲದ ವಲಯ | Wide enough to tempt, no net progress | Sitting out is a decision |
| Liquidity sweep | Price pierces a recent extreme, closes back inside, then runs | Put the stop beyond the wick |
| ಸಂಕುಚನ → ವಿಸ್ತರಣೆ | Tight coil followed by expansion | Wait for the break |

Each candidate gets a quality score. Distance saturates deliberately: a 25 ATR
run is not three times as teachable as an 8 ATR one, it is just rarer. Path
efficiency carries the most weight, because directness is what makes a leg
readable to a beginner. Overlapping candidates are collapsed so you review one
view of each event, not twenty.

**Create draft drill** turns any candidate into a draft in one click, with the
lesson pre-filled. You then write a proper Kannada title, check it by running it
yourself, and set it live.

The scanner proposes. You decide. A window it scores 94 might still be a bad
drill because of something it cannot see, and a 60 might be perfect for the
point you want to make this week.

## Building a drill by hand

1. `/admin` → upload a CSV. Give it an internal name and a neutral student-facing
   label.
2. **New drill.** Pick the dataset, then choose a window: `start bar`,
   `visible` (what they see at once, 90 works well) and `forward` (how many bars
   they reveal, 60 is about ten minutes of student time).
3. Write the objective as **one sentence naming one lesson**. "ಪ್ರವೃತ್ತಿಗೆ ವಿರುದ್ಧ
   ಟ್ರೇಡ್ ಬೇಡ" is a drill. "Learn price action" is not.
4. Set the order limit. Three is right for most drills; one forces real
   selectivity; ten is for a stamina drill about overtrading.
5. Save as `draft`, run it yourself once, then switch to `live`.

ATR is measured from the visible window when you save and drives the stop
guardrails, so it adapts to each instrument automatically.

### A curriculum worth charging for

The software is not the product — this sequence is. Five drills per level,
roughly:

| Level | Teaches | Drill design |
|---|---|---|
| 1 | Trend direction | Clean trending windows, 1 order, wide forward window |
| 2 | Entry and stop placement | Pullbacks into structure, 2 orders |
| 3 | Risk and drawdown | Choppy windows where the right answer is often no trade |
| 4 | Session behaviour | Asia range into London expansion, news bars |
| 5 | Open practice | Random windows, 5 orders, no hints |

Level 3 is the one that changes people. Build windows where a disciplined trader
scores 80 by taking one trade and passing on four, and let the leaderboard make
the point for you.

---

## Reading a student's habits

A scoreboard tells a student they scored 64. A mentor tells them *why* it keeps
happening. `src/insight.js` is that second thing.

It reads the trades already stored and names patterns — never a single trade,
because one bad trade is noise. Nothing appears until a student has at least
eight trades on record; below that any claim would be a guess dressed up as
analysis. Every finding cites the numbers behind it, so a student can check the
claim against their own history rather than taking it on faith:

> **ಸ್ಟಾಪ್ ತುಂಬಾ ಬಿಗಿಯಾಗಿದೆ** — ನಿಮ್ಮ ಸ್ಟಾಪ್ ಸರಾಸರಿ 0.58 ATR ದೂರ ಇದೆ. 14 ಟ್ರೇಡ್‌ಗಳಲ್ಲಿ 9 ಸ್ಟಾಪ್ ಹಿಟ್ ಆದವು.

What it looks for: trading against the window's actual direction, stops narrower
than the instrument's own noise, planned ratios below 1:1.5, winners closed
before half the target, using every allowed order in every drill, and skipping
the journal. It also names strengths — a mentor who only lists faults stops
being believed, and patience is worth saying out loud when it shows up.

Counter-trend detection needs to know which way the window went, which is why
drills created through the scanner store the structure and bias it found.
Hand-built drills leave those null and that one reading is simply skipped.

## Levels open as they are earned

All drills used to be visible at once, which let a beginner open a level-5
window and learn nothing from it. A level now opens when two drills in the
previous level are finished at 60 or above. Locked drills stay visible but dim,
so the path ahead is legible without being walkable yet.

## Pages

| Path | Who | What |
|---|---|---|
| `/` | Students | Drills grouped by level, with your completed scores |
| `/drill/:id` | Students | The replay terminal |
| `/drill/:id/result` | Students | Session report — score, stats, every trade |
| `/leaderboard` | Everyone | Average score, minimum three drills to appear |
| `/me` | Students | Career stats across every session |
| `/admin` | You | Datasets, drills, uploads |
| `/admin/dataset/:id/scan` | You | Scan a dataset for teachable windows |
| `/admin/drill/:id/sessions` | You | Every student's trades and written reasons |

The leaderboard ranks on **average score across at least three drills**, not
total R. One lucky session cannot buy the top spot, and a student who runs many
drills badly cannot grind their way up.

---

## Honest limitations

**This is not a moat.** Bar replay exists in TradingView, Forex Tester, Soft4FX
and half a dozen web apps. What none of them have is Kannada, a structured QCI
curriculum, a mentor reading the written reasons, and a community where the
weekly leaderboard gets announced. Sell that, not the software.

**Identity is phone-only.** No OTP. Someone could run a drill as a friend. Fine
for practice and recognition; add verification before certificates or prizes
carry weight.

**One session per student per drill.** Deliberate — a drill you can retry is a
memory test, not a decision test. Build new drills instead of allowing retries.

**Spread, slippage and swap are not simulated.** Fills happen exactly at the
stop or target. Real scalping is meaningfully worse than this, which is worth
saying out loud to students who start posting big R numbers.

**Data volume.** A dataset is one JSON object in R2; each drill stores its own
small window, so runtime reads stay tiny regardless of dataset size. Keep single
uploads under roughly 20,000 bars.

**DPDP Act.** You are storing names and phone numbers. Say so in your privacy
policy and tell the community where their number goes.

---

## Files

```
wrangler.toml          bindings
schema.sql             tables
src/index.js           routing, session mechanics, admin
src/engine.js          simulation, statistics, scoring — read this first
src/csv.js             OHLC parser for MT5 and generic exports
src/scan.js            drill-window scanner and session tagging
src/insight.js         reads recurring habits out of trade history
src/chart.js           canvas candlestick renderer, served to the browser
src/replay-client.js   replay controller, served to the browser
src/ui.js              student pages and design tokens
src/admin.js           mentor pages
```

`engine.js`, `csv.js`, `scan.js` and `insight.js` have no Cloudflare dependencies. Import them in Node to
test a scoring change against real sessions before it reaches a student.
