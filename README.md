# Dota 2 Match Prediction Model

A prediction model for professional Dota 2 matches, plus the betting tracker that
measures whether acting on it was worth anything.

The model is the interesting half. It takes an Elo rating, layers a set of adjustments on
top, and produces a win probability. What makes it more than a pile of heuristics is that
every one of those layers has been tested against historical results by walk-forward
replay, and most of them don't survive the test. That finding is in this README rather
than quietly omitted from it.

---

## The model

[`lib/model/predict.ts`](lib/model/predict.ts) starts with an Elo rating, applies
adjustments in log odds space, then clamps the result between 5% and 95%.

- **Elo**, team strength, built by walking every pro match in chronological order
- **Head to head**, how these two have done against each other before
- **Side**, how a team's radiant/dire record deviates from its own overall win rate
- **Roster stability**, a penalty for recently changed line ups
- **Fatigue**, games played in the last 24 and 48 hours
- **Draft**, archetype matchup, player hero comfort, combo synergy, lane outcomes

Elo is rebuilt by replaying matches in order rather than aggregating a season, so a
team's rating at any point in time reflects only what had happened by then. That property
is what makes the backtest possible at all.

Tournament stage and patch age deliberately don't touch the probability. The stage of a
match is a fact about the match, not about either team, so adding it to the log odds
quietly biased every prediction toward whichever team got passed in first. Both feed the
confidence score instead.

Given odds, the model reports its edge over the implied probability and a Kelly stake,
capped at 25% of bankroll and usually taken at half or quarter Kelly.

---

## Where the odds come from

Worth being precise about, because the model quotes an edge and the tracker reports
closing line value, yet the backtest below says there are no closing odds available.
Those aren't in conflict. They're three different sources:

| Number | Source |
|---|---|
| Placement odds | Read from your imported bet history, so they're whatever you actually got |
| Live model edge | Odds you hand the model at prediction time, typed in or taken from the book you're looking at |
| Closing odds for CLV | Entered by hand per bet in the bets table, after the match starts |

So a bet you placed yourself ends up with both a placement price and, if you bother to
record it, a closing price. What doesn't exist anywhere is a **historical archive of
closing prices for matches you didn't bet on**, and that's the thing a backtest would
need to score profitability across thousands of past matches. Neither OpenDota nor STRATZ
carries bookmaker prices at all.

That's why the backtest measures calibration and not ROI. Calibration only needs to know
who won.

---

## The backtest

`npm run model:backtest` replays history in time order. For each match it builds a
prediction using only state from before that match, and folds the result in afterwards.
That ordering is what makes it leak free, so it's a property of how the code is
structured rather than something a future reader has to remember. Three checks hold it in
place, including one that says the very first match in the stream has to price at exactly
50%, and another that says flipping that match's winner mustn't change the prediction.

Only four layers can be replayed honestly: **elo, h2h, side, fatigue**. Roster stability
needs dated roster history, and the draft layers need per match picks. The team match
endpoint carries neither. Replaying them from today's values would leak the future into
the past, which is precisely what the backtest exists to catch, so they're left out
rather than faked.

Layers get scored by ablation. Each one is removed in turn to see what the model loses
without it, measured on log loss and Brier score rather than accuracy, because a betting
model needs calibrated probabilities and accuracy can't see those.

### Current results

Over 1,322 out of sample matches (2,309 total, after a 30% Elo burn in and a minimum of
10 prior games per team):

```
Full model    log-loss 0.66177   brier 0.23452   accuracy 59.4%
Elo alone     log-loss 0.66172
Coin flip     log-loss 0.69315

Ablation: change in log-loss when each layer is removed
(10,000-sample paired bootstrap, 95% percentile interval)

  layer      delta        95% interval            verdict
  elo         +0.03016    [+0.01324, +0.04663]    keep
  fatigue     +0.00032    [-0.00019, +0.00085]    inconclusive
  side        +0.00005    [-0.00065, +0.00076]    inconclusive
  h2h         -0.00043    [-0.00113, +0.00026]    inconclusive
```

Elo is doing basically all of the work. The full model beats Elo on its own by 0.00005
log loss, which is nothing. Every other layer's confidence interval crosses zero, so on
this sample they're indistinguishable from noise in either direction.

Worth dwelling on: the point estimates by themselves would have said "drop head to head,
keep side and fatigue." The bootstrap says the data can't support any of those three
calls. That gap is the whole reason the intervals are there. A delta of -0.0004 across
1,322 matches is a coin landing slightly oddly, not a result.

Runs are saved to `backtest_runs` and `backtest_ablations` in Postgres, so the evidence
outlives any one browser or machine.

### Known limits

- **No ROI against the closing line**, for the reason set out above. There's no
  historical archive of bookmaker prices to score against, so calibration is what gets
  measured.
- **One circuit, one year.** The match pool is the TI 2026 teams since October 2025. None
  of this generalises to other games or other tiers without rerunning it.
- **59.4% accuracy isn't an edge.** Bookmakers close somewhere around 55 to 60% on these
  matches. Any real edge would have to come from Elo being better calibrated than the
  book, which needs the closing odds the project doesn't have.
- **Three layers are untested, not vindicated.** Inconclusive means the sample is too
  small to tell, not that the layers are worthless. A wider match pool would give them a
  fair test.

---

## The tracker

The other half of the project. You import bets by pasting the bookmaker's account
activity list straight into the app.

That list is a cash flow ledger rather than a list of bets, which makes it trickier than
it looks. A bet shows up once when you place it, then again only if it paid something
back. [`lib/parse-bets.ts`](lib/parse-bets.ts) pairs those rows back up to work out what
each bet actually was.

| Situation | How it's detected |
|---|---|
| Win | Return equals stake × odds |
| Cash out | Money came back, but not the full payout |
| Refund / void | Return equals the stake exactly. Skipped, so it can't distort win rate or ROI |
| Loss | Stake left the balance, and something else on that match paid out afterwards |
| Pending | Stake left the balance, nothing on that match has paid out, and it's recent |

Losses and pending bets are the awkward case. A loss pays nothing at settlement, so in a
cash flow ledger it looks exactly like a bet that's still running. The parser works
around this by checking whether anything else on the same match has paid out since. If
nothing on that match ever did, it falls back to a six hour recency window.

Every bet is hashed on when it was **placed**, never on how it turned out. So when you
re-import after a bet settles, it updates the existing row instead of adding a second
one. Pending bets turn into wins or losses on your next paste, and anything you edited by
hand (tag, game, closing odds) survives.

### What it shows

- **Dashboard**, balance, true P/L against deposits and withdrawals, profit curve
- **History**, every bet, filterable, with per-bet game and tag overrides
- **Analytics**, ROI by tag, calibration by odds band, variance, closing line value
- **Daily Log**, day by day balance, P/L and ROI with deposits and withdrawals folded in
- **Research**, opponent and matchup lookups against live Dota 2 data
- **Model**, predictions, edge against the bookmaker, and Kelly staking

A few of the analytics are worth calling out. **Calibration** groups your bets by odds
and compares the implied probability to how often they actually landed, so you can see
which price ranges you're sharp in. **Variance** shows max drawdown, longest streaks, and
the losing streak you should expect given your own win rate (via Schilling's
approximation), which helps separate bad luck from a broken edge. **CLV** tracks whether
you beat the closing line on bets where you recorded the close, and that predicts long
run profit better than recent results do.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

You'll need a `.env.local`. Supabase holds bets, transactions, ratings and backtest
results:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SECRET_KEY=
POSTGRES_URL_NON_POOLING=     # direct connection, used by the scripts
STRATZ_API_KEY=               # hero meta, matchups, match research
PANDASCORE_API_KEY=           # live and upcoming matches
OPENDOTA_API_KEY=             # optional, raises the rate limit
```

Apply the migrations in [`supabase/migrations/`](supabase/migrations/) in order.

If the app loads but there's no data, check the Supabase project isn't paused. Free tier
projects suspend themselves after a while without traffic.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run model:check` | Arithmetic and leak-safety checks, no network or database needed |
| `npm run model:backtest` | Walk-forward replay and ablation (`--refresh`, `--dry-run`) |
| `npm run model:setup` | Create the model tables |
| `npm run model:populate` | Populate every model table |
| `npm run model:refresh-heroes` | Refresh hero meta from STRATZ |
| `npm run model:refresh-teams` | Rebuild Elo ratings chronologically |

`model:check` covers the formulas that are easy to get subtly wrong and hard to spot
afterwards: CLV sign, Kelly, Elo symmetry, bootstrap determinism, and the replay's leak
safety. It doesn't need any credentials, so it's cheap to run after every change to the
model.

The backtest caches its OpenDota history in `.cache/`, since a full fetch takes about four
minutes against the rate limit. Use `--refresh` to refetch.

---

## Layout

```
app/              Next.js routes and API handlers
components/       UI, including the tracker tabs and model dashboard
lib/
  model/
    predict.ts        Layer combination and Kelly staking
    elo.ts            Elo maths and DB-backed predictions
    context.ts        H2H, side, roster, fatigue, patch age
    replay.ts         Walk-forward replay, scoring, bootstrap, ablation
    match-history.ts  Shared chronological match stream
  parse-bets.ts   Ledger parsing, bet pairing, statistics
  actions.ts      Server actions for bets and transactions
  clv.ts          Closing line value
scripts/          Populate, backtest and check scripts (run with tsx)
supabase/migrations/
```

One thing that matters more than it looks: the layer formulas are exported from
`context.ts` and used by both the live model and the backtest. If the backtest had its own
copy, the two would drift apart and it would end up measuring a model that no longer
ships.
