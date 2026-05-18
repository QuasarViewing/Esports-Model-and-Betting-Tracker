import { NextRequest, NextResponse } from 'next/server'
import { getLiveMatches } from '@/lib/pandascore-live'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const game = (searchParams.get('game') || 'dota2') as 'dota2' | 'lol' | 'csgo' | 'valorant'

  try {
    const matches = await getLiveMatches(game)
    return NextResponse.json(matches)
  } catch (error) {
    console.error('[v0] Live matches API error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
