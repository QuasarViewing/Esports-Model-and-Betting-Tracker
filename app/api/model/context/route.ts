import { NextRequest, NextResponse } from 'next/server'
import {
  getHeadToHead,
  getMapSideAdvantage,
  getRosterStability,
  getScheduleFatigue,
  getTournamentStageMultiplier,
  getPatchAge,
} from '@/lib/model/context'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teamAId, teamBId, side, stage, matchTime } = body

    if (!teamAId || !teamBId) {
      return NextResponse.json(
        { error: 'teamAId and teamBId are required' },
        { status: 400 },
      )
    }

    const teamASide = side ?? 'radiant'
    const teamBSide = teamASide === 'radiant' ? 'dire' : 'radiant'
    const now = matchTime ?? new Date().toISOString()

    const [h2h, sideA, sideB, rosterA, rosterB, fatigueA, fatigueB] = await Promise.all([
      getHeadToHead(teamAId, teamBId),
      getMapSideAdvantage(teamAId, teamASide),
      getMapSideAdvantage(teamBId, teamBSide),
      getRosterStability(teamAId),
      getRosterStability(teamBId),
      getScheduleFatigue(teamAId, now),
      getScheduleFatigue(teamBId, now),
    ])

    const tournament = getTournamentStageMultiplier(stage ?? 'group_stage')
    const patchAge = getPatchAge()

    return NextResponse.json({
      h2h,
      sideAdvantage: { teamA: sideA, teamB: sideB },
      roster: { teamA: rosterA, teamB: rosterB },
      fatigue: { teamA: fatigueA, teamB: fatigueB },
      tournamentMultiplier: tournament,
      patchAge,
    })
  } catch (error) {
    console.error('[model/context] error:', error)
    return NextResponse.json({ error: 'Failed to compute context' }, { status: 500 })
  }
}
