import { NextRequest, NextResponse } from 'next/server'
import {
  classifyDraft,
  getArchetypeMatchup,
  getComboSynergyScore,
  inferPositions,
} from '@/lib/model/archetypes'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const radiantHeroes: number[] = body.radiantHeroes
    const direHeroes: number[] = body.direHeroes
    let radiantPositions: number[] | undefined = body.radiantPositions
    let direPositions: number[] | undefined = body.direPositions

    if (
      !Array.isArray(radiantHeroes) || radiantHeroes.length === 0 ||
      !Array.isArray(direHeroes) || direHeroes.length === 0
    ) {
      return NextResponse.json(
        { error: 'Body must include radiantHeroes and direHeroes arrays' },
        { status: 400 },
      )
    }

    if (!radiantPositions && radiantHeroes.length === 5) {
      radiantPositions = await inferPositions(radiantHeroes)
    }
    if (!direPositions && direHeroes.length === 5) {
      direPositions = await inferPositions(direHeroes)
    }

    const [radiantClass, direClass, radiantCombo, direCombo] = await Promise.all([
      classifyDraft(radiantHeroes, radiantPositions),
      classifyDraft(direHeroes, direPositions),
      getComboSynergyScore(radiantHeroes),
      getComboSynergyScore(direHeroes),
    ])

    const matchup = getArchetypeMatchup(radiantClass.weights, direClass.weights)

    const advantage =
      matchup.teamAWinProb > 0.52
        ? 'Radiant draft advantage'
        : matchup.teamAWinProb < 0.48
          ? 'Dire draft advantage'
          : 'Even draft'

    return NextResponse.json({
      radiant: radiantClass,
      dire: direClass,
      matchup,
      radiantCombo,
      direCombo,
      overallAdvantage: advantage,
    })
  } catch (error) {
    console.error('[model/classify-draft] error:', error)
    return NextResponse.json({ error: 'Failed to classify draft' }, { status: 500 })
  }
}
