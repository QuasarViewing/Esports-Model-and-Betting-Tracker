import { NextRequest, NextResponse } from 'next/server'
import { getTournamentsPandaScore } from '@/lib/pandascore'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const game = (searchParams.get('game') || 'dota2') as 'dota2' | 'lol' | 'csgo' | 'valorant'
  const status = (searchParams.get('status') || 'ongoing') as 'upcoming' | 'ongoing' | 'completed'

  try {
    const tournaments = await getTournamentsPandaScore(game, status)
    return NextResponse.json(tournaments)
  } catch (error) {
    console.error('[v0] Tournaments API error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
