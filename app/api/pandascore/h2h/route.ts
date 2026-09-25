import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHeadToHeadPandaScore } from '@/lib/pandascore-live'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const team1 = sp.get('team1')
  const team2 = sp.get('team2')
  const game = sp.get('game') as 'dota2' | 'lol' | 'csgo' | 'valorant'

  if (!team1 || !team2 || !game) {
    return NextResponse.json({ error: 'Missing team names or game' }, { status: 400 })
  }

  const supabase = await createClient()
  const [t1, t2] = [team1, team2].sort()

  const { data: cached } = await supabase
    .from('head_to_head')
    .select('*')
    .eq('team1_name', t1)
    .eq('team2_name', t2)
    .eq('game', game)
    .gt('last_updated', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .single()

  if (cached) return NextResponse.json(cached)

  try {
    const h2h = await getHeadToHeadPandaScore(team1, team2, game)
    if (!h2h) return NextResponse.json({ error: 'H2H data not found' }, { status: 404 })

    const { data: upserted } = await supabase
      .from('head_to_head')
      .upsert(
        {
          team1_name: t1,
          team2_name: t2,
          team1_wins: t1 === team1 ? h2h.team1_wins : h2h.team2_wins,
          team2_wins: t1 === team1 ? h2h.team2_wins : h2h.team1_wins,
          draws: h2h.draws,
          game,
          last_met: h2h.last_met,
          last_updated: new Date().toISOString(),
        },
        { onConflict: 'team1_name,team2_name,game' }
      )
      .select()
      .single()

    return NextResponse.json(upserted || h2h)
  } catch (error) {
    console.error('[pandascore h2h] error:', error)
    return NextResponse.json({ error: 'Failed to fetch H2H data' }, { status: 500 })
  }
}
