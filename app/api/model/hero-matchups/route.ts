import { NextRequest, NextResponse } from 'next/server'
import { getHeroMatchups } from '@/lib/opendota'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const heroId = request.nextUrl.searchParams.get('heroId')
  if (!heroId) {
    return NextResponse.json({ error: 'heroId is required' }, { status: 400 })
  }

  const matchups = await getHeroMatchups(Number(heroId))
  return NextResponse.json(matchups)
}
