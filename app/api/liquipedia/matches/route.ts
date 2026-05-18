'use server'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LiquipediaAPI } from '@/lib/liquipedia'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const teamName = searchParams.get('team')
  const game = searchParams.get('game') as 'dota2' | 'lol' | 'csgo' | 'valorant'
  const limit = parseInt(searchParams.get('limit') || '10')

  if (!teamName || !game) {
    return NextResponse.json({ error: 'Missing team name or game' }, { status: 400 })
  }

  const supabase = await createClient()

  // Get team ID first
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', teamName)
    .eq('game', game)
    .single()

  // Check cache first (data less than 6 hours old)
  if (team) {
    const { data: cached } = await supabase
      .from('match_results')
      .select('*')
      .eq('team_id', team.id)
      .gt('last_updated', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
      .order('match_date', { ascending: false })
      .limit(limit)

    if (cached && cached.length > 0) {
      return NextResponse.json(cached)
    }
  }

  // Fetch from Liquipedia
  try {
    const api = new LiquipediaAPI(game)
    const matchHistory = await api.getRecentMatches(teamName, limit)

    if (matchHistory && matchHistory.length > 0) {
      // Ensure team exists in cache
      let teamId = team?.id
      if (!teamId) {
        const { data: newTeam } = await supabase
          .from('teams')
          .upsert({ name: teamName, game, last_updated: new Date().toISOString() }, { onConflict: 'name,game' })
          .select('id')
          .single()
        teamId = newTeam?.id
      }

      if (teamId) {
        // Insert match results
        const matchRecords = matchHistory.map(m => ({
          team_id: teamId,
          opponent_name: m.opponent,
          result: m.result,
          score: m.score,
          match_date: m.date,
          tournament: m.tournament,
          game,
          last_updated: new Date().toISOString()
        }))

        await supabase.from('match_results').upsert(matchRecords)
      }

      return NextResponse.json(matchHistory)
    }

    return NextResponse.json([])
  } catch (error) {
    console.error('Liquipedia API error:', error)
    return NextResponse.json({ error: 'Failed to fetch match history' }, { status: 500 })
  }
}
