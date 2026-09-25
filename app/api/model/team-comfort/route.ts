import { NextRequest, NextResponse } from 'next/server'
import { getTeamDraftComfort } from '@/lib/model/player-comfort'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const players: { accountId: number; heroId: number }[] = body.players

    if (!Array.isArray(players) || players.length === 0) {
      return NextResponse.json(
        { error: 'Body must include players: [{accountId, heroId}, ...]' },
        { status: 400 },
      )
    }

    const result = await getTeamDraftComfort(players)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[model/team-comfort] error:', error)
    return NextResponse.json({ error: 'Failed to calculate team comfort' }, { status: 500 })
  }
}
