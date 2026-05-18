'use server'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LiquipediaAPI } from '@/lib/liquipedia'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const team1 = searchParams.get('team1')
  const team2 = searchParams.get('team2')
  const game = searchParams.get('game') as 'dota2' | 'lol' | 'csgo' | 'valorant'

  if (!team1 || !team2 || !game) {
    return NextResponse.json({ error: 'Missing team names or game' }, { status: 400 })
  }

  const supabase = await createClient()

  // Normalize team order for consistent caching
  const [t1, t2] = [team1, team2].sort()

  // Check cache first (data less than 24 hours old)
  const { data: cached } = await supabase
    .from('head_to_head')
    .select('*')
    .eq('team1_name', t1)
    .eq('team2_name', t2)
    .eq('game', game)
    .gt('last_updated', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .single()

  if (cached) {
    return NextResponse.json(cached)
  }

  // Fetch from Liquipedia
  try {
    const api = new LiquipediaAPI(game)
    const h2hData = await api.getHeadToHead(team1, team2)

    if (h2hData) {
      // Upsert to cache
      const { data: upserted } = await supabase
        .from('head_to_head')
        .upsert({
          team1_name: t1,
          team2_name: t2,
          team1_wins: t1 === team1 ? h2hData.team1Wins : h2hData.team2Wins,
          team2_wins: t1 === team1 ? h2hData.team2Wins : h2hData.team1Wins,
          draws: h2hData.draws,
          game,
          last_met: h2hData.lastMet,
          last_updated: new Date().toISOString()
        }, { onConflict: 'team1_name,team2_name,game' })
        .select()
        .single()

      return NextResponse.json(upserted || h2hData)
    }

    return NextResponse.json({ error: 'H2H data not found' }, { status: 404 })
  } catch (error) {
    console.error('Liquipedia API error:', error)
    return NextResponse.json({ error: 'Failed to fetch H2H data' }, { status: 500 })
  }
}
