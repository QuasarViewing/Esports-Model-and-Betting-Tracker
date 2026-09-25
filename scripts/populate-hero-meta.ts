import { pool } from './db'
import { CURRENT_PATCH } from '../lib/model/constants'

const stratzKey = process.env.STRATZ_API_KEY?.replace(/^["']|["']$/g, '')
if (!stratzKey) { console.error('STRATZ_API_KEY not found in .env.local'); process.exit(1) }

async function gql(query: string) {
  const res = await fetch('https://api.stratz.com/graphql', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${stratzKey}`, 'Content-Type': 'application/json', 'User-Agent': 'DotaModel/1.0' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`STRATZ ${res.status}: ${await res.text()}`)
  return res.json()
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('[populate-hero-meta] Pro matches only (CAPTAINS_MODE), patch-weighted\n')

  // Hero names
  console.log('  Fetching hero names...')
  const heroData = await gql(`{ constants { heroes { id displayName } } }`)
  const heroNames = new Map<number, string>()
  for (const h of heroData.data.constants.heroes) {
    if (h.id && h.displayName) heroNames.set(h.id, h.displayName)
  }
  console.log(`  ${heroNames.size} heroes`)

  await sleep(1000)

  // Win rates per hero per patch — CAPTAINS_MODE only (pro game mode)
  console.log('  Fetching win rates by patch (Captains Mode only)...')
  const winData = await gql(`{
    heroStats {
      winGameVersion(
        gameModeIds: [CAPTAINS_MODE]
        take: 20000
      ) {
        heroId
        gameVersionId
        matchCount
        winCount
      }
    }
  }`)

  const rows = winData.data.heroStats.winGameVersion
  console.log(`  ${rows.length} raw rows`)

  // Aggregate by hero × patch
  const heroPatches = new Map<string, { wins: number; matches: number }>()
  for (const r of rows) {
    const key = `${r.heroId}_${r.gameVersionId}`
    const entry = heroPatches.get(key) ?? { wins: 0, matches: 0 }
    entry.wins += r.winCount
    entry.matches += r.matchCount
    heroPatches.set(key, entry)
  }

  // Patch weights — current patch highest, decay over 2 years
  const PATCH_WEIGHTS: Record<number, number> = {
    182: 3.0, 181: 2.5, 180: 2.0, 179: 1.5,
    178: 1.2, 177: 1.0, 176: 0.8, 175: 0.6, 173: 0.4, 172: 0.3,
  }
  const patchIds = Object.keys(PATCH_WEIGHTS).map(Number)

  // Compute weighted win rate per hero
  const heroStats = new Map<number, { weightedWr: number; currentPatchWr: number; totalMatches: number }>()

  for (const heroId of heroNames.keys()) {
    let wWins = 0, wMatches = 0, totalMatches = 0
    let currentWr = 0.5, currentMatches = 0

    for (const patchId of patchIds) {
      const data = heroPatches.get(`${heroId}_${patchId}`)
      if (!data || data.matches === 0) continue
      const weight = PATCH_WEIGHTS[patchId] ?? 0.2
      wWins += data.wins * weight
      wMatches += data.matches * weight
      totalMatches += data.matches
      if (patchId === patchIds[0]) { currentWr = data.wins / data.matches; currentMatches = data.matches }
    }

    heroStats.set(heroId, {
      weightedWr: wMatches > 0 ? wWins / wMatches : 0.5,
      currentPatchWr: currentMatches > 0 ? currentWr : (wMatches > 0 ? wWins / wMatches : 0.5),
      totalMatches,
    })
  }

  await sleep(1000)

  // Pick stats from CM games
  console.log('  Fetching pick stats (CM)...')
  const statsData = await gql(`{
    heroStats {
      stats(bracketBasicIds: [ALL]) {
        heroId
        matchCount
        winCount
      }
    }
  }`)

  let totalPicks = 0
  const pickMap = new Map<number, number>()
  for (const s of (statsData.data?.heroStats?.stats ?? [])) {
    pickMap.set(s.heroId, s.matchCount)
    totalPicks += s.matchCount
  }

  // Save
  console.log('  Saving to database...')
  const latestPatch = CURRENT_PATCH
  let saved = 0

  for (const [heroId, name] of heroNames) {
    const stats = heroStats.get(heroId) ?? { weightedWr: 0.5, currentPatchWr: 0.5, totalMatches: 0 }
    const picks = pickMap.get(heroId) ?? 0

    await pool.query(
      `INSERT INTO hero_meta (hero_id, hero_name, patch, pro_win_rate, immortal_win_rate, pro_pick_rate, pro_ban_rate, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, NOW())
       ON CONFLICT (hero_id, patch) DO UPDATE SET
         hero_name = $2, pro_win_rate = $4, immortal_win_rate = $5, pro_pick_rate = $6, updated_at = NOW()`,
      [heroId, name, latestPatch, stats.weightedWr, stats.currentPatchWr, totalPicks > 0 ? picks / totalPicks : 0],
    )
    saved++
  }

  const ranked = [...heroStats.entries()].filter(([id]) => heroNames.has(id)).sort((a, b) => b[1].weightedWr - a[1].weightedWr)
  console.log('\n  Top 10 (CM, patch-weighted):')
  for (const [id, s] of ranked.slice(0, 10))
    console.log(`    ${(s.weightedWr * 100).toFixed(1)}%  ${heroNames.get(id)?.padEnd(20)} (${s.totalMatches} CM games)`)
  console.log('  Bottom 5:')
  for (const [id, s] of ranked.slice(-5))
    console.log(`    ${(s.weightedWr * 100).toFixed(1)}%  ${heroNames.get(id)?.padEnd(20)} (${s.totalMatches} CM games)`)

  console.log(`\n[populate-hero-meta] Done: ${saved} heroes (source: STRATZ Captains Mode, ${patchIds.length} patches)`)
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
