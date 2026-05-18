'use server'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeamInfo } from '@/lib/pandascore'

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

  // Fetch from PandaScore
  try {
    const teamData = await getTeamInfo(teamName, game)

    if (teamData) {
      // Upsert to cache
      const { data: upserted } = await supabase
        .from('teams')
        .upsert({
          name: teamData.name,
          short_name: teamData.abbreviation,
          game,
          region: teamData.region,
          logo_url: teamData.image_url,
          win_rate: teamData.win_rate,
          recent_form: null,
          liquipedia_url: null,
          last_updated: new Date().toISOString()
        }, { onConflict: 'name,game' })
        .select()
        .single()

      return NextResponse.json(upserted || teamData)
    }

    return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  } catch (error) {
    console.error('[v0] PandaScore team API error:', error)
    return NextResponse.json({ error: 'Failed to fetch team data' }, { status: 500 })
  }
}
