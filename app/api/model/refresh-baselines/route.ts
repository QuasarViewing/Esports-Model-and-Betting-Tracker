import { NextResponse } from 'next/server'
import { refreshHeroBaselines } from '@/lib/model/player-comfort'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const result = await refreshHeroBaselines()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[model/refresh-baselines] error:', error)
    return NextResponse.json({ error: 'Failed to refresh baselines' }, { status: 500 })
  }
}
