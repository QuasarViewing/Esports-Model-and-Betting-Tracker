// Worked examples for the model's easy-to-invert arithmetic. Pure functions
// only — no DB, no network. Run with `npm run model:check`.

import { readFileSync } from 'fs'
import { join } from 'path'
import { calculateKelly, getRecommendation } from '../lib/model/predict'
import { calculateExpectedScore } from '../lib/model/elo'
import { getTournamentStageMultiplier } from '../lib/model/context'
import { clvPercent } from '../lib/clv'
import {
  replayMatches, score, probabilityFor, bootstrapMeanCI, ablate,
  type ReplayedMatch,
} from '../lib/model/replay'

let failures = 0

// A replayed match with every layer neutral, for exercising the scorer alone.
function synthetic(id: number, radiantWon: boolean, elo: number): ReplayedMatch {
  return {
    match_id: id,
    start_time: 1_760_000_000 + id,
    radiant_id: 1,
    dire_id: 2,
    radiantWon,
    eloRadiant: 1500,
    eloDire: 1500,
    priorGamesRadiant: 50,
    priorGamesDire: 50,
    contributions: { elo, h2h: 0, side: 0, fatigue: 0 },
  }
}

function check(name: string, actual: unknown, expected: unknown) {
  const ok = Math.abs(Number(actual) - Number(expected)) < 1e-6
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n        expected ${expected}, got ${actual}`}`)
}

function checkThat(name: string, condition: boolean) {
  if (!condition) failures++
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`)
}

// --- CLV -------------------------------------------------------------------
// Beating the close means getting a longer price than the market settled at.

checkThat('CLV: backed 2.10, closed 1.90 -> positive', clvPercent(2.10, 1.90)! > 0)
check('CLV: backed 2.10, closed 1.90 -> +10.53%', clvPercent(2.10, 1.90)!.toFixed(2), '10.53')
checkThat('CLV: backed 1.90, closed 2.10 -> negative', clvPercent(1.90, 2.10)! < 0)
check('CLV: no line movement -> 0%', clvPercent(2.00, 2.00), 0)
checkThat('CLV: closing odds of 1.00 rejected', clvPercent(2.00, 1.00) === null)

// --- Tournament stage ------------------------------------------------------
// The stage is a property of the match, so it must never move the probability.

const grandFinal = getTournamentStageMultiplier('grand_final')
const openQualifier = getTournamentStageMultiplier('open_qualifier')
checkThat('Stage: grand final rated above open qualifier', grandFinal > openQualifier)
checkThat(
  'Stage: multiplier is a confidence scalar, never a log-odds term',
  !/logOdds\s*\+=.*tournament/.test(
    readFileSync(join(__dirname, '../lib/model/predict.ts'), 'utf8'),
  ),
)

// --- Elo -------------------------------------------------------------------

check('Elo: equal ratings -> 50%', calculateExpectedScore(1500, 1500), 0.5)
checkThat('Elo: +400 rating -> ~91%', Math.abs(calculateExpectedScore(1900, 1500) - 0.909) < 0.001)
checkThat('Elo: symmetric', Math.abs(
  calculateExpectedScore(1600, 1400) + calculateExpectedScore(1400, 1600) - 1,
) < 1e-9)

// --- Kelly -----------------------------------------------------------------

check('Kelly: no edge -> stake 0', calculateKelly(0.5, 2.0).fullKelly, 0)
check('Kelly: 60% at 2.00 -> 20% of bankroll', calculateKelly(0.6, 2.0).fullKelly, 0.2)
check('Kelly: half-Kelly is half of full', calculateKelly(0.6, 2.0).halfKelly, 0.1)
check('Kelly: capped at 25%', calculateKelly(0.95, 3.0).fullKelly, 0.25)

// --- Recommendation --------------------------------------------------------

checkThat('Recommendation: negative edge -> avoid', getRecommendation(-2, 0.9) === 'avoid')
checkThat('Recommendation: big edge needs confidence', getRecommendation(20, 0.4) !== 'strong_bet')

// --- Replay scoring --------------------------------------------------------

const perfect = [synthetic(1, true, 0), synthetic(2, true, 0)]
check('Score: 50/50 guesses -> log-loss of ln 2', score(perfect, ['elo']).logLoss, Math.log(2))
check('Score: 50/50 guesses -> brier of 0.25', score(perfect, ['elo']).brier, 0.25)
check('Score: no layers -> same as a coin flip', score(perfect, []).logLoss, Math.log(2))

// --- Replay leak-safety ----------------------------------------------------
// The whole argument for the backtest is that a prediction cannot see its own
// result. Both teams start at the default rating, so the very first meeting has
// to be an even-money call no matter who ends up winning.

const firstMeeting = replayMatches([
  { match_id: 1, start_time: 1_760_000_000, radiant_id: 100, dire_id: 200, radiant_win: true },
])
check('Leak-safety: first-ever match predicted at 50%', probabilityFor(firstMeeting[0], ['elo']), 0.5)

const flipped = replayMatches([
  { match_id: 1, start_time: 1_760_000_000, radiant_id: 100, dire_id: 200, radiant_win: false },
])
checkThat(
  'Leak-safety: flipping the result does not change the prediction',
  probabilityFor(firstMeeting[0], ['elo']) === probabilityFor(flipped[0], ['elo']),
)

const streak = replayMatches([
  { match_id: 1, start_time: 1_760_000_000, radiant_id: 100, dire_id: 200, radiant_win: true },
  { match_id: 2, start_time: 1_760_100_000, radiant_id: 100, dire_id: 200, radiant_win: true },
  { match_id: 3, start_time: 1_760_200_000, radiant_id: 100, dire_id: 200, radiant_win: true },
])
checkThat(
  'Replay: Elo rises for the winner across the stream',
  streak[2].eloRadiant > streak[1].eloRadiant && streak[1].eloRadiant > streak[0].eloRadiant,
)
checkThat('Replay: prior-game counts increase', streak[2].priorGamesRadiant === 2)
checkThat(
  'Replay: H2H stays neutral below the 3-meeting minimum',
  streak[2].contributions.h2h === 0,
)

// --- Bootstrap -------------------------------------------------------------

const noisy = Array.from({ length: 500 }, (_, i) => Math.sin(i * 12.9898) * 0.05)
const ciA = bootstrapMeanCI(noisy, { samples: 2000 })
const ciB = bootstrapMeanCI(noisy, { samples: 2000 })

checkThat('Bootstrap: same seed gives the same interval', ciA.low === ciB.low && ciA.high === ciB.high)
checkThat('Bootstrap: interval brackets the sample mean', ciA.low <= ciA.mean && ciA.mean <= ciA.high)
checkThat(
  'Bootstrap: different seeds shift the interval',
  bootstrapMeanCI(noisy, { samples: 2000, seed: 1 }).low !==
  bootstrapMeanCI(noisy, { samples: 2000, seed: 2 }).low,
)

const constant = bootstrapMeanCI(Array(200).fill(0.4), { samples: 500 })
checkThat(
  'Bootstrap: zero-variance sample gives a zero-width interval',
  // Resampling changes the summation order, so equality holds only to rounding.
  Math.abs(constant.high - constant.low) < 1e-12 && Math.abs(constant.mean - 0.4) < 1e-12,
)

const clearlyPositive = bootstrapMeanCI(Array.from({ length: 800 }, () => 1), { samples: 500 })
checkThat('Bootstrap: an unambiguous effect excludes zero', clearlyPositive.low > 0)

check('Bootstrap: empty sample is inert', bootstrapMeanCI([], { samples: 100 }).samples, 0)

// A layer that contributes nothing must never be reported as demonstrated
// signal — this is the guard against reading noise as a finding.
const inert = [
  synthetic(1, true, 0.2), synthetic(2, false, 0.2),
  synthetic(3, true, -0.1), synthetic(4, false, -0.1),
]
const inertReport = ablate(inert, { bootstrapSamples: 500 })
checkThat(
  'Ablation: layers with no contribution are not claimed as signal',
  !inertReport.keptLayers.includes('h2h') &&
  !inertReport.keptLayers.includes('side') &&
  !inertReport.keptLayers.includes('fatigue'),
)

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`)
process.exit(failures === 0 ? 0 : 1)
