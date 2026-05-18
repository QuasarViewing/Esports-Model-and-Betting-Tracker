'use server'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LiquipediaAPI } from '@/lib/liquipedia'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const teamName = searchParams.get('name')
  const game = searchParams.get('game') as 'dota2' | 'lol' | 'csgo' | 'valorant'

  if (!teamName || !game) {
    return NextResponse.json({ error: 'Missing team name or game' }, { status: 400 })
  }

  const supabase = await createClient()

  // Check cache first (data less than 1 hour old)
  const { data: cached } = await supabase
    .from('teams')
    .select('*')
    .eq('name', teamName)
    .eq('game', game)
    .gt('last_updated', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .single()

  if (cached) {
    return NextResponse.json(cached)
  }

  // Fetch from Liquipedia
  try {
    const api = new LiquipediaAPI(game)
    const teamData = await api.getTeamInfo(teamName)

    if (teamData) {
      // Upsert to cache
      const { data: upserted } = await supabase
        .from('teams')
        .upsert({
          name: teamData.name,
          short_name: teamData.shortName,
          game,
          region: teamData.region,
          logo_url: teamData.logoUrl,
          win_rate: teamData.winRate,
          recent_form: teamData.recentForm,
          liquipedia_url: teamData.liquipediaUrl,
          last_updated: new Date().toISOString()
        }, { onConflict: 'name,game' })
        .select()
        .single()

      return NextResponse.json(upserted || teamData)
    }

    return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  } catch (error) {
    console.error('Liquipedia API error:', error)
    return NextResponse.json({ error: 'Failed to fetch team data' }, { status: 500 })
  }
}
