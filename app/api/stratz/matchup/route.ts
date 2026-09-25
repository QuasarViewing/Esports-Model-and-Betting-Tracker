import { NextResponse } from 'next/server'
import { getMatchupResearch, summarizeMatchup } from '@/lib/stratz'
import { findTeamId } from '@/lib/opendota'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const team1 = searchParams.get('team1')?.trim()
  const team2 = searchParams.get('team2')?.trim()

  if (!team1 || !team2) {
    return NextResponse.json({ error: 'team1 and team2 required' }, { status: 400 })
  }

  // STRATZ has no team-name search — resolve canonical Dota 2 team IDs via OpenDota first.
  // OpenDota's team_id is the same identifier STRATZ uses internally.
  const [idA, idB] = await Promise.all([findTeamId(team1), findTeamId(team2)])

  if (idA == null || idB == null) {
    return NextResponse.json(
      {
        error: 'team not found',
        matchedA: idA != null ? team1 : null,
        matchedB: idB != null ? team2 : null,
      },
      { status: 404 }
    )
  }

  const matchup = await getMatchupResearch(idA, idB)
  const summary = summarizeMatchup(matchup)

  return NextResponse.json({
    matchedA: summary.teamA?.name ?? team1,
    matchedB: summary.teamB?.name ?? team2,
    summary,
  })
}
