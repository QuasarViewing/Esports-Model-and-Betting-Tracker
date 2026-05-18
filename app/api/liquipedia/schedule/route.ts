import { NextRequest, NextResponse } from 'next/server'
import { getUpcomingMatchesPandaScore } from '@/lib/pandascore'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const game = (searchParams.get('game') || 'dota2') as 'dota2' | 'lol' | 'csgo' | 'valorant'
  const limit = parseInt(searchParams.get('limit') || '15')

  try {
    const matches = await getUpcomingMatchesPandaScore(game, limit)
    return NextResponse.json(matches)
  } catch (error) {
    console.error('[v0] Schedule API error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
