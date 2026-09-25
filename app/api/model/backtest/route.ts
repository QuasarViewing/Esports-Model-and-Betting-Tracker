import { NextRequest, NextResponse } from 'next/server'
import { recordResult, getModelPerformance } from '@/lib/model/backtest'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const performance = await getModelPerformance()
    return NextResponse.json(performance)
  } catch (error) {
    console.error('[model/backtest] error:', error)
    return NextResponse.json({ error: 'Failed to get performance' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { predictionId, actualWinner } = body

    if (!predictionId || !actualWinner) {
      return NextResponse.json(
        { error: 'predictionId and actualWinner are required' },
        { status: 400 },
      )
    }

    await recordResult(predictionId, actualWinner)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[model/backtest] error:', error)
    return NextResponse.json({ error: 'Failed to record result' }, { status: 500 })
  }
}
