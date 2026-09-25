import { NextRequest, NextResponse } from 'next/server'
import { getRecentMatchesPandaScore } from '@/lib/pandascore-live'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const teamName = sp.get('team')
  const game = sp.get('game') as 'dota2' | 'lol' | 'csgo' | 'valorant'
  const limit = parseInt(sp.get('limit') || '10', 10)

  if (!teamName || !game) {
    return NextResponse.json({ error: 'Missing team name or game' }, { status: 400 })
  }

  try {
    const matches = await getRecentMatchesPandaScore(teamName, game, limit)
    return NextResponse.json(matches)
  } catch (error) {
    console.error('[pandascore matches] error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
