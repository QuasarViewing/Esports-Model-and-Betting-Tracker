import { NextRequest, NextResponse } from 'next/server'
import { getTournamentsPandaScore } from '@/lib/pandascore'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const game = (sp.get('game') || 'dota2') as 'dota2' | 'lol' | 'csgo' | 'valorant'
  const status = (sp.get('status') || 'ongoing') as 'upcoming' | 'ongoing' | 'completed'

  try {
    return NextResponse.json(await getTournamentsPandaScore(game, status))
  } catch (error) {
    console.error('[pandascore tournaments] error:', error)
    return NextResponse.json([])
  }
}
