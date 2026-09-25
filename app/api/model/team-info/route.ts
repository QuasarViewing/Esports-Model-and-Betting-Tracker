import { NextRequest, NextResponse } from 'next/server'
import { getTeamInfo, getTeamPlayers, getTeamHeroes, findTeamId } from '@/lib/opendota'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  let id: number | null = null

  const teamIdParam = request.nextUrl.searchParams.get('teamId')
  const teamNameParam = request.nextUrl.searchParams.get('teamName')

  if (teamIdParam) {
    id = Number(teamIdParam)
  } else if (teamNameParam) {
    id = await findTeamId(teamNameParam)
  }

  if (!id) {
    return NextResponse.json({ error: 'teamId or teamName is required' }, { status: 400 })
  }

  const [team, players, heroes] = await Promise.all([
    getTeamInfo(id),
    getTeamPlayers(id),
    getTeamHeroes(id),
  ])

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  }

  return NextResponse.json({ team, players, heroes })
}
