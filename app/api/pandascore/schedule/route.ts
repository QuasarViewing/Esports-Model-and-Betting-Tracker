import { NextRequest, NextResponse } from 'next/server'
import { getUpcomingMatchesPandaScore } from '@/lib/pandascore'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const game = (sp.get('game') || 'dota2') as 'dota2' | 'lol' | 'csgo' | 'valorant'
  const limit = parseInt(sp.get('limit') || '15', 10)

  try {
    const live = await getUpcomingMatchesPandaScore(game, limit)
    return NextResponse.json(live || [])
  } catch (error) {
    console.error('[pandascore schedule] error:', error)
    return NextResponse.json([])
  }
}
