import { pool } from './db'
import { CURRENT_PATCH } from '../lib/model/constants'

const stratzKey = process.env.STRATZ_API_KEY?.replace(/^["']|["']$/g, '')
if (!stratzKey) { console.error('STRATZ_API_KEY not found in .env.local'); process.exit(1) }

async function gql(query: string): Promise<any> {
  const res = await fetch('https://api.stratz.com/graphql', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${stratzKey}`, 'Content-Type': 'application/json', 'User-Agent': 'DotaModel/1.0' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`STRATZ ${res.status}: ${text.slice(0, 200)}`)
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`STRATZ returned non-JSON (${text.slice(0, 100)})`)
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// Time-decay weight: matches from today get 1.0, matches from 2 years ago get ~0.3
function timeWeight(matchTimestamp: number, now: number): number {
  const ageSeconds = now - matchTimestamp
  const ageDays = ageSeconds / 86400
  if (ageDays <= 90) return 1.0     // last 3 months: full weight
  if (ageDays <= 180) return 0.85   // 3-6 months
  if (ageDays <= 365) return 0.6    // 6-12 months
  return 0.35                        // 12-24 months
}

interface ProMatch {
  radiantHeroes: number[]
  direHeroes: number[]
  radiantWin: boolean
  timestamp: number
}

async function batchUpsert(
  table: string, columns: string[], conflictCols: string[], updateCols: string[], rows: unknown[][],
) {
  if (rows.length === 0) return
  const BATCH = 100
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const placeholders: string[] = []
    const values: unknown[] = []
    for (let r = 0; r < batch.length; r++) {
      const offset = r * columns.length
      placeholders.push(`(${columns.map((_, c) => `$${offset + c + 1}`).join(', ')})`)
      values.push(...batch[r])
    }
    const sql = `INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (${conflictCols.join(', ')}) DO UPDATE SET ${updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ')}`
    await pool.query(sql, values)
  }
}

async function main() {
  console.log('[populate-hero-matchups] Pro league matches only, time-weighted\n')

  const patch = CURRENT_PATCH
  const now = Math.floor(Date.now() / 1000)
  const twoYearsAgo = now - (2 * 365 * 86400)

  // 1. Get pro league IDs from last 2 years, filter to tier 1-2 quality
  console.log('  Fetching pro leagues (last 2 years)...')
  const leagueData = await gql(`{
    leagues(request: {
      tiers: [PROFESSIONAL, MAJOR, INTERNATIONAL, DPC_LEAGUE, DPC_LEAGUE_FINALS]
      betweenStartDateTime: ${twoYearsAgo}
      betweenEndDateTime: ${now}
      take: 200
      skip: 0
    }) {
      id
      displayName
      tier
      prizePool
      lastMatchDate
      stats { matchCount }
    }
  }`)

  const MIN_PRIZE_POOL = 40000
  const allLeagues = leagueData.data?.leagues ?? []
  const leagues = allLeagues.filter((l: any) => {
    const prize = l.prizePool ?? 0
    const name: string = l.displayName ?? ''
    if (prize >= MIN_PRIZE_POOL) return true
    if (name.includes('Road To The International')) return true
    if (l.tier === 'INTERNATIONAL' || l.tier === 'MAJOR') return true
    return false
  })
  console.log(`  ${leagues.length} tier 1-2 leagues (from ${allLeagues.length} total)`)
  for (const l of leagues) {
    console.log(`    $${l.prizePool ?? 0} — "${l.displayName}" (${l.stats?.matchCount ?? 0} matches)`)
  }

  leagues.sort((a: any, b: any) => (b.lastMatchDate || 0) - (a.lastMatchDate || 0))

  await sleep(1000)

  // 2. Fetch matches from each league
  const allMatches: ProMatch[] = []
  let leaguesDone = 0

  for (const league of leagues) {
    const matchCount = league.stats?.matchCount ?? 0
    if (matchCount === 0) { leaguesDone++; continue }

    try {
      for (let skip = 0; skip < matchCount; skip += 100) {
        const r = await gql(`{
          league(id: ${league.id}) {
            matches(request: { skip: ${skip}, take: 100 }) {
              id
              startDateTime
              didRadiantWin
              players {
                heroId
                isRadiant
              }
            }
          }
        }`)

        const matches = r.data?.league?.matches ?? []
        for (const m of matches) {
          if (!m.players?.length) continue
          const radiant = m.players.filter((p: any) => p.isRadiant).map((p: any) => p.heroId).filter(Boolean)
          const dire = m.players.filter((p: any) => !p.isRadiant).map((p: any) => p.heroId).filter(Boolean)
          if (radiant.length === 5 && dire.length === 5) {
            allMatches.push({
              radiantHeroes: radiant,
              direHeroes: dire,
              radiantWin: m.didRadiantWin,
              timestamp: m.startDateTime ?? league.lastMatchDate ?? now,
            })
          }
        }

        if (matches.length < 100) break
        await sleep(500)
      }
    } catch (err: any) {
      console.log(`    Skipping league ${league.id}: ${err.message?.slice(0, 80)}`)
    }

    leaguesDone++
    if (leaguesDone % 20 === 0) {
      console.log(`    [${leaguesDone}/${leagues.length}] ${allMatches.length} matches collected...`)
    }

    await sleep(300)
  }

  console.log(`\n  Total pro matches: ${allMatches.length}`)

  // 3. Compute matchup and synergy matrices with time weighting
  console.log('  Computing matchup matrices...')

  // VS: hero on opposite teams
  const vsMap = new Map<string, { weightedWins: number; weightedGames: number; rawGames: number }>()
  // WITH: hero on same team
  const withMap = new Map<string, { weightedWins: number; weightedGames: number; rawGames: number }>()
  // Overall hero stats
  const heroWins = new Map<number, { weightedWins: number; weightedGames: number; rawGames: number; bans: number }>()

  for (const match of allMatches) {
    const w = timeWeight(match.timestamp, now)
    const winners = match.radiantWin ? match.radiantHeroes : match.direHeroes
    const losers = match.radiantWin ? match.direHeroes : match.radiantHeroes

    // VS matchups: each radiant hero vs each dire hero
    for (const rHero of match.radiantHeroes) {
      for (const dHero of match.direHeroes) {
        // From rHero's perspective vs dHero
        const keyR = `${rHero}_${dHero}`
        const eR = vsMap.get(keyR) ?? { weightedWins: 0, weightedGames: 0, rawGames: 0 }
        eR.weightedGames += w
        eR.rawGames++
        if (match.radiantWin) eR.weightedWins += w
        vsMap.set(keyR, eR)

        // From dHero's perspective vs rHero
        const keyD = `${dHero}_${rHero}`
        const eD = vsMap.get(keyD) ?? { weightedWins: 0, weightedGames: 0, rawGames: 0 }
        eD.weightedGames += w
        eD.rawGames++
        if (!match.radiantWin) eD.weightedWins += w
        vsMap.set(keyD, eD)
      }
    }

    // WITH synergies: pairs on same team
    for (const team of [match.radiantHeroes, match.direHeroes]) {
      const teamWon = team === (match.radiantWin ? match.radiantHeroes : match.direHeroes)
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          const id1 = Math.min(team[i], team[j])
          const id2 = Math.max(team[i], team[j])
          const key = `${id1}_${id2}`
          const e = withMap.get(key) ?? { weightedWins: 0, weightedGames: 0, rawGames: 0 }
          e.weightedGames += w
          e.rawGames++
          if (teamWon) e.weightedWins += w
          withMap.set(key, e)
        }
      }
    }

    // Overall hero stats
    for (const hero of [...winners, ...losers]) {
      const e = heroWins.get(hero) ?? { weightedWins: 0, weightedGames: 0, rawGames: 0, bans: 0 }
      e.weightedGames += w
      e.rawGames++
      if (winners.includes(hero)) e.weightedWins += w
      heroWins.set(hero, e)
    }
  }

  console.log(`  ${vsMap.size} VS matchup pairs, ${withMap.size} WITH synergy pairs`)

  // 4. Save VS matchups (min 5 pro games)
  console.log('  Saving VS matchups...')
  const vsRows: unknown[][] = []
  let vsSkipped = 0
  for (const [key, data] of vsMap) {
    if (data.rawGames < 5) { vsSkipped++; continue }
    const [h1, h2] = key.split('_').map(Number)
    const wr = data.weightedWins / data.weightedGames
    vsRows.push([h1, h2, data.rawGames, Math.round(data.weightedWins), wr, patch, 'stratz_pro'])
  }

  await batchUpsert(
    'hero_matchups',
    ['hero_id', 'opponent_hero_id', 'games', 'wins', 'win_rate', 'patch', 'data_source'],
    ['hero_id', 'opponent_hero_id', 'patch'],
    ['games', 'wins', 'win_rate', 'data_source'],
    vsRows,
  )
  console.log(`  ${vsRows.length} VS matchups saved (${vsSkipped} skipped < 5 games)`)

  // 5. Save WITH synergies (min 3 pro games)
  console.log('  Saving WITH synergies...')
  const withRows: unknown[][] = []
  let withSkipped = 0
  for (const [key, data] of withMap) {
    if (data.rawGames < 3) { withSkipped++; continue }
    const [id1, id2] = key.split('_').map(Number)
    const wr = data.weightedWins / data.weightedGames
    const synergy = wr - 0.5
    withRows.push([id1, id2, data.rawGames, Math.round(data.weightedWins), wr, synergy, patch])
  }

  await batchUpsert(
    'hero_synergies',
    ['hero_id_1', 'hero_id_2', 'games', 'wins', 'win_rate', 'synergy_score', 'patch'],
    ['hero_id_1', 'hero_id_2', 'patch'],
    ['games', 'wins', 'win_rate', 'synergy_score'],
    withRows,
  )
  console.log(`  ${withRows.length} WITH synergies saved (${withSkipped} skipped < 3 games)`)

  // Print highlights
  const topVs = [...vsMap.entries()]
    .filter(([, d]) => d.rawGames >= 20)
    .sort((a, b) => (b[1].weightedWins / b[1].weightedGames) - (a[1].weightedWins / a[1].weightedGames))

  console.log('\n  Best matchups (20+ pro games):')
  for (const [key, d] of topVs.slice(0, 5)) {
    const [h1, h2] = key.split('_').map(Number)
    console.log(`    hero${h1} vs hero${h2}: ${(d.weightedWins / d.weightedGames * 100).toFixed(1)}% WR (${d.rawGames} games)`)
  }

  console.log(`\n[populate-hero-matchups] Done (source: ${allMatches.length} pro league matches, time-weighted)`)
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
