import { NextRequest, NextResponse } from 'next/server'
import { analyzePatch, trackPatchPredictions } from '@/lib/model/patch-analyzer'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patchNotes, patchVersion } = body

    if (!patchNotes || typeof patchNotes !== 'string') {
      return NextResponse.json(
        { error: 'patchNotes string is required' },
        { status: 400 },
      )
    }

    const analysis = await analyzePatch(patchNotes)

    if (patchVersion) {
      await trackPatchPredictions(patchVersion, analysis)
    }

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('[model/analyze-patch] error:', error)
    const message = error instanceof Error ? error.message : 'Failed to analyze patch'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
