import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeamInfo } from '@/lib/pandascore'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const teamName = sp.get('name')
  const game = sp.get('game') as 'dota2' | 'lol' | 'csgo' | 'valorant'

  if (!teamName || !game) {
    return NextResponse.json({ error: 'Missing team name or game' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: cached } = await supabase
    .from('teams')
    .select('*')
    .eq('name', teamName)
    .eq('game', game)
    .gt('last_updated', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .single()

  if (cached) return NextResponse.json(cached)

  try {
    const team = await getTeamInfo(teamName, game)
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

    const { data: upserted } = await supabase
      .from('teams')
      .upsert(
        {
          name: team.name,
          short_name: team.abbreviation,
          game,
          region: team.region,
          logo_url: team.image_url,
          win_rate: null,
          recent_form: null,
          liquipedia_url: null,
          last_updated: new Date().toISOString(),
        },
        { onConflict: 'name,game' }
      )
      .select()
      .single()

    return NextResponse.json(upserted || team)
  } catch (error) {
    console.error('[pandascore team] error:', error)
    return NextResponse.json({ error: 'Failed to fetch team data' }, { status: 500 })
  }
}
