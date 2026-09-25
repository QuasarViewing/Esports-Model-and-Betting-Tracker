import { NextRequest, NextResponse } from 'next/server'
import { getTeamRecord } from '@/lib/pandascore-live'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const teamName = searchParams.get('name') || ''
  const game = (searchParams.get('game') || 'dota2') as 'dota2' | 'lol' | 'csgo' | 'valorant'

  if (!teamName) {
    return NextResponse.json({ error: 'Team name required' }, { status: 400 })
  }

  try {
    const record = await getTeamRecord(teamName, game)
    return NextResponse.json(record || {})
  } catch (error) {
    console.error('Team record API error:', error)
    return NextResponse.json({}, { status: 200 })
  }
}
