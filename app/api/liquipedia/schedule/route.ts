import { NextRequest, NextResponse } from 'next/server'
import { getUpcomingMatchesPandaScore } from '@/lib/pandascore'
import { getUpcomingMatches } from '@/lib/upcoming-matches'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const game = (searchParams.get('game') || 'dota2') as 'dota2' | 'lol' | 'csgo' | 'valorant'
  const limit = parseInt(searchParams.get('limit') || '15')

  try {
    // Try PandaScore first
    const pandaMatches = await getUpcomingMatchesPandaScore(game, limit)
    
    // If PandaScore returns data, use it; otherwise fall back to seeded data
    if (pandaMatches && pandaMatches.length > 0) {
      return NextResponse.json(pandaMatches)
    }
    
    // Fall back to seeded data for Dota 2
    if (game === 'dota2') {
      const seedMatches = getUpcomingMatches(game)
      return NextResponse.json(seedMatches)
    }
    
    return NextResponse.json([], { status: 200 })
  } catch (error) {
    console.error('[v0] Schedule API error:', error)
    // Return seeded data on error for Dota 2
    if (game === 'dota2') {
      const seedMatches = getUpcomingMatches(game)
      return NextResponse.json(seedMatches)
    }
    return NextResponse.json([], { status: 200 })
  }
}
