import { NextRequest, NextResponse } from 'next/server'
import {
  getEloPrediction,
  getTeamRatingWithContext,
} from '@/lib/model/elo'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const teamId = sp.get('teamId')
  const teamA = sp.get('teamA')
  const teamB = sp.get('teamB')

  if (teamA && teamB) {
    const prediction = await getEloPrediction(Number(teamA), Number(teamB))
    return NextResponse.json(prediction)
  }

  if (teamId) {
    const context = await getTeamRatingWithContext(Number(teamId))
    return NextResponse.json(context)
  }

  return NextResponse.json(
    { error: 'Provide ?teamId=ID or ?teamA=ID&teamB=ID' },
    { status: 400 },
  )
}

export async function POST() {
  return NextResponse.json({
    error: 'Team ratings are built via the populate-team-ratings.ts script (global chronological Elo). Run: npx tsx scripts/populate-team-ratings.ts',
  }, { status: 400 })
}
