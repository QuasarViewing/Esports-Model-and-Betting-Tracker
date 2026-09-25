import { NextResponse } from 'next/server'
import {
  findTeamId,
  getTeamMatches,
  getHeroStats,
  getTeamHeroes,
  getMatchDetail,
} from '@/lib/opendota'
import { getMatchupResearch } from '@/lib/stratz'
import {
  getUpcomingMatchesPandaScore,
  getTournamentsPandaScore,
} from '@/lib/pandascore'
import { parseBettingData, calculateStats } from '@/lib/parse-bets'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type TestResult = {
  ok: boolean
  ms: number
  value?: unknown
  error?: string
  note?: string
}

async function run<T>(fn: () => Promise<T>, project: (v: T) => unknown = v => v): Promise<TestResult> {
  const start = Date.now()
  try {
    const v = await fn()
    return { ok: true, ms: Date.now() - start, value: project(v) }
  } catch (e) {
    return {
      ok: false,
      ms: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

function summarize<T extends Record<string, TestResult>>(group: T) {
  const tests = Object.values(group)
  const passed = tests.filter(t => t.ok).length
  return { passed, total: tests.length, ms: tests.reduce((s, t) => s + t.ms, 0) }
}

// Sample of the tab-betting-site export format the parser expects.
const PARSER_SAMPLE = [
  'Win\t18/05/26\t12:22PM\tWinner\tTeam Spirit vs Falcons\t1.85\t50.00\t42.50\t542.50',
  'Loss\t17/05/26\t03:15PM\tWinner\tG2 vs Fnatic\t2.10\t40.00\t-40.00\t500.00',
  'Stake\t16/05/26\t07:00PM\tWinner\tTundra vs Liquid\t1.95\t50.00\t0.00\t500.00',
  'Deposit\t01/05/26\t10:00AM\tDeposit\tBank Transfer\t0\t0\t500.00\t500.00',
].join('\n')

export async function GET() {
  // --- OpenDota probe chain ---
  // Resolve a known org first; downstream tests reuse the discovered ID.
  const oddTeamIdTest = await run(
    () => findTeamId('Team Spirit'),
    v => v,
  )
  const teamId = typeof oddTeamIdTest.value === 'number' ? oddTeamIdTest.value : null

  const oddTeamMatchesTest = teamId
    ? await run(
        () => getTeamMatches(teamId, 5),
        v => ({ count: v.length, sample: v[0] ?? null }),
      )
    : { ok: false, ms: 0, error: 'skipped: no teamId from findTeamId' }

  // Pick a match_id from the team matches result so we test getMatchDetail on real data.
  const firstMatchId =
    oddTeamMatchesTest.ok &&
    oddTeamMatchesTest.value &&
    typeof oddTeamMatchesTest.value === 'object' &&
    'sample' in oddTeamMatchesTest.value &&
    (oddTeamMatchesTest.value as { sample: { match_id?: number } | null }).sample?.match_id
      ? (oddTeamMatchesTest.value as { sample: { match_id: number } }).sample.match_id
      : null

  const oddHeroStatsTest = await run(
    () => getHeroStats(),
    v => ({ count: v.length, firstHero: v[0]?.localized_name ?? null }),
  )

  const oddTeamHeroesTest = teamId
    ? await run(
        () => getTeamHeroes(teamId),
        v => ({ count: v.length, topHero: v[0] ?? null }),
      )
    : { ok: false, ms: 0, error: 'skipped: no teamId' }

  const oddMatchDetailTest = firstMatchId
    ? await run(
        () => getMatchDetail(firstMatchId),
        v => ({
          match_id: v?.match_id,
          parsed: v?.version != null,
          picksBansCount: v?.picks_bans?.length ?? 0,
          playerCount: v?.players?.length ?? 0,
        }),
      )
    : { ok: false, ms: 0, error: 'skipped: no match_id from team matches' }

  const opendota = {
    findTeamId: oddTeamIdTest,
    getTeamMatches: oddTeamMatchesTest,
    getHeroStats: oddHeroStatsTest,
    getTeamHeroes: oddTeamHeroesTest,
    getMatchDetail: oddMatchDetailTest,
  }

  // --- STRATZ probe ---
  // Needs a second team — resolve Falcons or fall back gracefully.
  const stratzKeySet = !!process.env.STRATZ_API_KEY
  let stratzMatchupTest: TestResult = {
    ok: false,
    ms: 0,
    error: 'skipped: STRATZ_API_KEY not set',
  }

  if (stratzKeySet && teamId) {
    const secondIdResult = await run(() => findTeamId('Team Falcons'))
    const teamBId = typeof secondIdResult.value === 'number' ? secondIdResult.value : null

    if (teamBId) {
      stratzMatchupTest = await run(
        () => getMatchupResearch(teamId, teamBId),
        v => ({
          teamA: v.teamA
            ? { id: v.teamA.id, name: v.teamA.name, matches: v.teamA.matches.length }
            : null,
          teamB: v.teamB
            ? { id: v.teamB.id, name: v.teamB.name, matches: v.teamB.matches.length }
            : null,
          samplePickBans: v.teamA?.matches[0]?.pickBans.slice(0, 4) ?? null,
        }),
      )
    } else {
      stratzMatchupTest = {
        ok: false,
        ms: 0,
        error: 'skipped: could not resolve second team id via OpenDota',
      }
    }
  }

  const stratz = {
    keySet: stratzKeySet,
    getMatchupResearch: stratzMatchupTest,
  }

  // --- PandaScore probe ---
  const pandaKeySet = !!process.env.PANDASCORE_API_KEY

  const pandaUpcomingTest = pandaKeySet
    ? await run(
        () => getUpcomingMatchesPandaScore('dota2', 5),
        v => ({ count: v.length, sample: v[0] ?? null }),
      )
    : { ok: false, ms: 0, error: 'skipped: PANDASCORE_API_KEY not set' }

  const pandaTournamentsTest = pandaKeySet
    ? await run(
        () => getTournamentsPandaScore('dota2', 'ongoing'),
        v => ({ count: v.length, sample: v[0] ?? null }),
      )
    : { ok: false, ms: 0, error: 'skipped: PANDASCORE_API_KEY not set' }

  const pandascore = {
    keySet: pandaKeySet,
    getUpcomingMatches: pandaUpcomingTest,
    getTournaments: pandaTournamentsTest,
  }

  // --- Parser probe ---
  const parseTest = await run(
    async () => parseBettingData(PARSER_SAMPLE),
    v => ({
      bets: v.bets.length,
      transactions: v.transactions.length,
      sampleBet: v.bets[0]
        ? {
            type: v.bets[0].type,
            stake: v.bets[0].stake,
            profitLoss: v.bets[0].profitLoss,
            game: v.bets[0].game,
          }
        : null,
      sampleTx: v.transactions[0]
        ? { type: v.transactions[0].type, amount: v.transactions[0].amount }
        : null,
    }),
  )

  const statsTest = await run(
    async () => {
      const { bets } = parseBettingData(PARSER_SAMPLE)
      return calculateStats(bets)
    },
    v => ({
      totalBets: v.totalBets,
      winCount: v.winCount,
      lossCount: v.lossCount,
      winRate: Number(v.winRate.toFixed(1)),
      pendingBets: v.pendingBets,
      profitByDayPoints: v.profitByDay.length,
    }),
  )

  // Verify the loss sign-preservation fix: should be -40, not +40.
  const lossSignTest = await run(
    async () => {
      const { bets } = parseBettingData(PARSER_SAMPLE)
      const loss = bets.find(b => b.type === 'loss')
      if (!loss) throw new Error('no loss bet parsed')
      if (loss.profitLoss >= 0) throw new Error(`loss profitLoss should be negative, got ${loss.profitLoss}`)
      return loss.profitLoss
    },
    v => ({ profitLoss: v }),
  )

  const parsing = {
    parseBettingData: parseTest,
    calculateStats: statsTest,
    lossSignPreserved: lossSignTest,
  }

  // --- Supabase read probe ---
  const dbTest = await run(
    async () => {
      const supabase = await createClient()
      const [bets, tx] = await Promise.all([
        supabase.from('bets').select('id', { count: 'exact', head: true }),
        supabase.from('transactions').select('id', { count: 'exact', head: true }),
      ])
      if (bets.error) throw new Error(`bets: ${bets.error.message}`)
      if (tx.error) throw new Error(`transactions: ${tx.error.message}`)
      return { bets: bets.count ?? 0, transactions: tx.count ?? 0 }
    },
    v => v,
  )

  const database = { supabaseRead: dbTest }

  // --- Summary ---
  const summary = {
    opendota: summarize(opendota),
    stratz: summarize({ matchup: stratzMatchupTest }),
    pandascore: summarize({ upcoming: pandaUpcomingTest, tournaments: pandaTournamentsTest }),
    parsing: summarize(parsing),
    database: summarize(database),
  }

  const totalPassed = Object.values(summary).reduce((s, g) => s + g.passed, 0)
  const totalTests = Object.values(summary).reduce((s, g) => s + g.total, 0)

  return NextResponse.json({
    overall: { passed: totalPassed, total: totalTests, ok: totalPassed === totalTests },
    summary,
    opendota,
    stratz,
    pandascore,
    parsing,
    database,
    env: {
      OPENDOTA_API_KEY: !!process.env.OPENDOTA_API_KEY,
      STRATZ_API_KEY: stratzKeySet,
      PANDASCORE_API_KEY: pandaKeySet,
    },
  })
}
