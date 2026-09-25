import { NextRequest, NextResponse } from 'next/server'
import { classifyDraft, getHeroArchetypeWeights } from '@/lib/model/archetypes'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const heroId = request.nextUrl.searchParams.get('heroId')
  const position = request.nextUrl.searchParams.get('position')

  if (!heroId) {
    return NextResponse.json({ error: 'heroId is required' }, { status: 400 })
  }

  const weights = await getHeroArchetypeWeights(
    Number(heroId),
    position ? Number(position) : undefined,
  )
  return NextResponse.json(weights)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const heroes: number[] = body.heroes
    const positions: number[] | undefined = body.positions

    if (!Array.isArray(heroes) || heroes.length === 0) {
      return NextResponse.json(
        { error: 'Body must include heroes: number[]' },
        { status: 400 },
      )
    }

    const result = await classifyDraft(heroes, positions)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[model/draft-archetype] error:', error)
    return NextResponse.json({ error: 'Failed to classify draft' }, { status: 500 })
  }
}
