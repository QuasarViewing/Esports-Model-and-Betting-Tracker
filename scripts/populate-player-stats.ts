import { pool } from './db'
import { TI_2026_TEAMS, CURRENT_PATCH } from '../lib/model/constants'

async function fetchJSON(url: string) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} on ${url}`)
  return res.json()
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function loadBaselines(): Promise<Map<number, number>> {
  const { rows } = await pool.query<{ hero_id: number; immortal_win_rate: number | null; pro_win_rate: number | null }>(
    `SELECT hero_id, immortal_win_rate, pro_win_rate FROM hero_meta WHERE patch = $1`, [CURRENT_PATCH],
  )
  const map = new Map<number, number>()
  for (const r of rows) {
    map.set(r.hero_id, r.immortal_win_rate ?? r.pro_win_rate ?? 0.5)
  }
  return map
}

function confidenceMultiplier(gamesPlayed: number): number {
  if (gamesPlayed < 5) return 0.3
  if (gamesPlayed < 10) return 0.5
  if (gamesPlayed < 20) return 0.7
  if (gamesPlayed < 50) return 0.9
  return 1.0
}

async function main() {
  console.log('[populate-player-stats] Starting...')

  const baselines = await loadBaselines()
  console.log(`  ${baselines.size} hero baselines loaded`)

  const heroes: { id: number; localized_name: string }[] = await fetchJSON('https://api.opendota.com/api/heroes')
  const heroNameMap = new Map(heroes.map(h => [h.id, h.localized_name]))

  let totalPlayers = 0
  let totalStats = 0

  for (const [teamName, teamId] of Object.entries(TI_2026_TEAMS)) {
    console.log(`\n  Team: ${teamName}`)

    try {
      const players: { account_id: number; name: string; is_current_team_member: boolean }[] =
        await fetchJSON(`https://api.opendota.com/api/teams/${teamId}/players`)

      const currentPlayers = players.filter(p => p.is_current_team_member).slice(0, 10)
      console.log(`    ${currentPlayers.length} current players`)

      for (const player of currentPlayers) {
        try {
          const heroStats: { hero_id: number; games: number; win: number; last_played: number }[] =
            await fetchJSON(`https://api.opendota.com/api/players/${player.account_id}/heroes`)

          for (const h of heroStats) {
            if (h.games === 0) continue
            const wr = h.win / h.games
            const baseline = baselines.get(h.hero_id) ?? 0.5
            const comfort = (wr - baseline) * confidenceMultiplier(h.games)

            await pool.query(
              `INSERT INTO player_hero_stats (account_id, player_name, hero_id, hero_name, games_played, wins, win_rate, comfort_score, last_played, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
               ON CONFLICT (account_id, hero_id) DO UPDATE SET
                 player_name = $2, hero_name = $4, games_played = $5, wins = $6, win_rate = $7, comfort_score = $8, last_played = $9, updated_at = NOW()`,
              [
                player.account_id,
                player.name,
                h.hero_id,
                heroNameMap.get(h.hero_id) ?? null,
                h.games,
                h.win,
                wr,
                comfort,
                h.last_played > 0 ? new Date(h.last_played * 1000).toISOString() : null,
              ],
            )
            totalStats++
          }

          totalPlayers++
          console.log(`    ${player.name}: ${heroStats.filter(h => h.games > 0).length} heroes`)
        } catch (err) {
          console.error(`    Error for player ${player.account_id}:`, err)
        }

        await sleep(1200)
      }
    } catch (err) {
      console.error(`    Error fetching team ${teamName}:`, err)
    }

    await sleep(1200)
  }

  console.log(`\n[populate-player-stats] Done: ${totalPlayers} players, ${totalStats} hero stats`)
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
