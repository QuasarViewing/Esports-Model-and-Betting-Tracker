import { NextRequest, NextResponse } from 'next/server'
import { validatePatchPredictions } from '@/lib/model/patch-analyzer'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const patch = request.nextUrl.searchParams.get('patch')
  if (!patch) {
    return NextResponse.json({ error: 'patch query param is required' }, { status: 400 })
  }

  try {
    const result = await validatePatchPredictions(patch)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[model/validate-patch] error:', error)
    return NextResponse.json({ error: 'Failed to validate' }, { status: 500 })
  }
}
