import { NextRequest, NextResponse } from 'next/server'
import { getTournaments, type GameType } from '@/lib/liquipedia'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const game = (searchParams.get('game') || 'dota2') as GameType
  const status = (searchParams.get('status') || 'all') as 'upcoming' | 'ongoing' | 'all'

  try {
    const tournaments = await getTournaments(game, status)
    return NextResponse.json(tournaments)
  } catch (error) {
    console.error('[v0] Tournaments API error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
