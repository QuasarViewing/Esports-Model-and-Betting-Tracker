import { NextRequest, NextResponse } from 'next/server'
import { analyzeArchetypeMatchup } from '@/lib/model/archetypes'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const teamAHeroes: number[] = body.teamAHeroes
    const teamBHeroes: number[] = body.teamBHeroes
    const teamAPositions: number[] | undefined = body.teamAPositions
    const teamBPositions: number[] | undefined = body.teamBPositions

    if (
      !Array.isArray(teamAHeroes) || teamAHeroes.length === 0 ||
      !Array.isArray(teamBHeroes) || teamBHeroes.length === 0
    ) {
      return NextResponse.json(
        { error: 'Body must include teamAHeroes and teamBHeroes arrays' },
        { status: 400 },
      )
    }

    const result = await analyzeArchetypeMatchup(
      teamAHeroes,
      teamBHeroes,
      teamAPositions,
      teamBPositions,
    )
    return NextResponse.json(result)
  } catch (error) {
    console.error('[model/archetype-matchup] error:', error)
    return NextResponse.json({ error: 'Failed to analyze matchup' }, { status: 500 })
  }
}
