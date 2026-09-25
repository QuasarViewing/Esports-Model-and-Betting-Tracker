import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './db'
import { fetchMatchHistory, type NormalizedMatch } from '../lib/model/match-history'
import {
  replayMatches,
  evaluationWindow,
  ablate,
  REPLAYABLE_LAYERS,
} from '../lib/model/replay'

const CUTOFF = 1759000000 // ~Oct 2025, matches populate-team-ratings
const BURN_IN_FRACTION = 0.3
const MIN_PRIOR_GAMES = 10

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_PATH = join(__dirname, '../.cache/match-history.json')

// OpenDota is rate limited to roughly one request a second, so a full fetch takes
// minutes. Cache it — the ablation gets re-run far more often than history changes.
async function loadMatches(refresh: boolean): Promise<NormalizedMatch[]> {
  if (!refresh && existsSync(CACHE_PATH)) {
    const cached = JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as NormalizedMatch[]
    console.log(`  ${cached.length} matches from cache (--refresh to refetch)`)
    return cached
  }

  console.log('  Fetching match history from OpenDota...')
  const matches = await fetchMatchHistory({
    cutoff: CUTOFF,
    onProgress: (done, total, label) => console.log(`    [${done}/${total}] ${label}`),
    onError: (label, err) => console.error(`    ${label}: ${err}`),
  })

  mkdirSync(dirname(CACHE_PATH), { recursive: true })
  writeFileSync(CACHE_PATH, JSON.stringify(matches))
  return matches
}

function pct(n: number) { return `${(n * 100).toFixed(1)}%` }
function iso(seconds: number) { return new Date(seconds * 1000).toISOString() }

async function main() {
  const refresh = process.argv.includes('--refresh')
  const dryRun = process.argv.includes('--dry-run')

  console.log('[backtest-replay] Walk-forward replay + layer ablation\n')

  const matches = await loadMatches(refresh)
  if (matches.length === 0) {
    console.error('  No matches available — run with --refresh')
    process.exit(1)
  }

  console.log(`  ${matches.length} matches, ${iso(matches[0].start_time).slice(0, 10)} to ${iso(matches[matches.length - 1].start_time).slice(0, 10)}`)

  const replayed = replayMatches(matches)
  const scored = evaluationWindow(replayed, {
    burnInFraction: BURN_IN_FRACTION,
    minPriorGames: MIN_PRIOR_GAMES,
  })

  console.log(`  ${scored.length} scored after ${pct(BURN_IN_FRACTION)} burn-in and ${MIN_PRIOR_GAMES}-game minimum\n`)

  if (scored.length === 0) {
    console.error('  Nothing left to score — loosen the burn-in or minimum.')
    process.exit(1)
  }

  const report = ablate(scored)

  console.log('  Full model')
  console.log(`    log-loss  ${report.baseline.logLoss.toFixed(5)}`)
  console.log(`    brier     ${report.baseline.brier.toFixed(5)}`)
  console.log(`    accuracy  ${pct(report.baseline.accuracy)}`)
  console.log(`    (elo alone: log-loss ${report.eloOnly.logLoss.toFixed(5)})`)
  console.log(`    (coin flip: log-loss ${Math.log(2).toFixed(5)})\n`)

  const signed = (n: number) => (n >= 0 ? `+${n.toFixed(5)}` : n.toFixed(5))

  console.log(`  Ablation — change in log-loss when each layer is removed`)
  console.log(`  (${report.bootstrapSamples.toLocaleString()}-sample paired bootstrap, 95% percentile interval)\n`)
  console.log('    layer      delta        95% interval              verdict')
  for (const row of [...report.rows].sort((a, b) => b.logLossDelta - a.logLossDelta)) {
    const interval = `[${signed(row.ci.low)}, ${signed(row.ci.high)}]`
    console.log(
      `    ${row.layer.padEnd(10)} ${signed(row.logLossDelta).padStart(9)}    ${interval.padEnd(24)}  ${row.verdict}`,
    )
  }

  console.log(`\n  Demonstrated signal: ${report.keptLayers.join(', ') || 'none'}`)
  console.log(`  Demonstrated harm:   ${report.droppedLayers.join(', ') || 'none'}`)
  console.log(`  Cannot tell:         ${report.inconclusiveLayers.join(', ') || 'none'}`)

  if (dryRun) {
    console.log('\n[backtest-replay] --dry-run, nothing written')
    await pool.end()
    return
  }

  const run = await pool.query(
    `INSERT INTO backtest_runs (
       matches_total, matches_scored, burn_in_frac, min_prior_games,
       earliest_match, latest_match, layers, kept_layers,
       dropped_layers, inconclusive_layers, bootstrap_samples,
       log_loss, brier, accuracy, elo_only_log_loss
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    [
      matches.length, scored.length, BURN_IN_FRACTION, MIN_PRIOR_GAMES,
      iso(scored[0].start_time), iso(scored[scored.length - 1].start_time),
      [...REPLAYABLE_LAYERS], report.keptLayers,
      report.droppedLayers, report.inconclusiveLayers, report.bootstrapSamples,
      report.baseline.logLoss, report.baseline.brier, report.baseline.accuracy,
      report.eloOnly.logLoss,
    ],
  )

  const runId = run.rows[0].id
  for (const row of report.rows) {
    await pool.query(
      `INSERT INTO backtest_ablations
         (run_id, layer, log_loss_without, log_loss_delta, brier_delta, earns_place, ci_low, ci_high, verdict)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        runId, row.layer, row.logLossWithout, row.logLossDelta, row.brierDelta,
        row.verdict === 'keep', row.ci.low, row.ci.high, row.verdict,
      ],
    )
  }

  console.log(`\n[backtest-replay] Saved run ${runId}`)
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
