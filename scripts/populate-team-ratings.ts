import { pool } from './db'
import {
  DEFAULT_ELO,
  K_FACTOR_NEW,
  K_FACTOR_ESTABLISHED,
  K_FACTOR_THRESHOLD,
  ELO_DIVISOR,
  TI_2026_TEAMS,
} from '../lib/model/constants'
import { fetchMatchHistory } from '../lib/model/match-history'

const CUTOFF = 1759000000 // ~Oct 2025

function calcExpected(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / ELO_DIVISOR))
}

function calcNewRating(current: number, expected: number, actual: number, k: number): number {
  return Math.round(current + k * (actual - expected))
}

async function main() {
  console.log('[populate-team-ratings] Starting — full history since Oct 2025...\n')

  const currentTeamIds = new Set(Object.values(TI_2026_TEAMS))
  const teamNames = Object.fromEntries(Object.entries(TI_2026_TEAMS).map(([n, id]) => [id, n]))

  const allMatches = await fetchMatchHistory({
    cutoff: CUTOFF,
    onProgress: (done, total, label) => console.log(`  [${done}/${total}] Fetching ${label}...`),
    onError: (label, err) => console.error(`    ${label} error:`, err),
  })

  console.log(`\n  Total unique matches: ${allMatches.length}`)

  const earliest = new Date(allMatches[0]?.start_time * 1000).toISOString().slice(0, 10)
  const latest = new Date(allMatches[allMatches.length - 1]?.start_time * 1000).toISOString().slice(0, 10)
  console.log(`  Date range: ${earliest} to ${latest}`)

  // Process all matches chronologically for Elo
  const ratings = new Map<number, { elo: number; played: number; wins: number; losses: number }>()

  for (const id of currentTeamIds) {
    ratings.set(id, { elo: DEFAULT_ELO, played: 0, wins: 0, losses: 0 })
  }

  for (const match of allMatches) {
    const rId = match.radiant_id
    const dId = match.dire_id

    if (!ratings.has(rId)) {
      ratings.set(rId, { elo: DEFAULT_ELO, played: 0, wins: 0, losses: 0 })
    }
    if (!ratings.has(dId)) {
      ratings.set(dId, { elo: DEFAULT_ELO, played: 0, wins: 0, losses: 0 })
    }

    const rR = ratings.get(rId)!
    const dR = ratings.get(dId)!

    const expectedR = calcExpected(rR.elo, dR.elo)
    const expectedD = 1 - expectedR
    const kR = rR.played < K_FACTOR_THRESHOLD ? K_FACTOR_NEW : K_FACTOR_ESTABLISHED
    const kD = dR.played < K_FACTOR_THRESHOLD ? K_FACTOR_NEW : K_FACTOR_ESTABLISHED

    if (match.radiant_win) {
      rR.elo = calcNewRating(rR.elo, expectedR, 1, kR)
      dR.elo = calcNewRating(dR.elo, expectedD, 0, kD)
      rR.wins++
      dR.losses++
    } else {
      rR.elo = calcNewRating(rR.elo, expectedR, 0, kR)
      dR.elo = calcNewRating(dR.elo, expectedD, 1, kD)
      rR.losses++
      dR.wins++
    }

    rR.played++
    dR.played++
  }

  // Print TI team ratings
  console.log('\n  TI 2026 Team Ratings:')
  const tiRatings = Object.entries(TI_2026_TEAMS)
    .map(([name, id]) => ({ name, id, ...ratings.get(id)! }))
    .sort((a, b) => b.elo - a.elo)

  for (const t of tiRatings) {
    const wr = t.played > 0 ? ((t.wins / t.played) * 100).toFixed(1) : '0.0'
    console.log(`    ${t.elo}  ${t.name.padEnd(18)} ${t.played} games (${wr}% WR)`)
  }

  // Save to DB — only save TI teams + their opponents
  console.log('\n  Saving ratings to database...')
  let saved = 0
  for (const [teamId, r] of ratings.entries()) {
    const name = teamNames[teamId] ?? `Team ${teamId}`
    await pool.query(
      `INSERT INTO team_ratings (team_id, team_name, elo_rating, matches_played, wins, losses, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (team_id) DO UPDATE SET
         team_name = $2, elo_rating = $3, matches_played = $4, wins = $5, losses = $6, updated_at = NOW()`,
      [teamId, name, r.elo, r.played, r.wins, r.losses],
    )
    saved++
  }

  console.log(`[populate-team-ratings] Done: ${saved} teams saved`)
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
