import { NextRequest, NextResponse } from 'next/server'
import { predictMatch } from '@/lib/model/predict'
import type { PredictionInput } from '@/lib/model/predict'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body: PredictionInput = await request.json()

    if (!body.teamA?.teamId || !body.teamB?.teamId) {
      return NextResponse.json(
        { error: 'teamA and teamB with teamId are required' },
        { status: 400 },
      )
    }

    const result = await predictMatch(body)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[model/predict] error:', error)
    return NextResponse.json({ error: 'Prediction failed' }, { status: 500 })
  }
}
