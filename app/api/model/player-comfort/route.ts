import { NextRequest, NextResponse } from 'next/server'
import { getPlayerComfortOnHero, getAllPlayerComfort } from '@/lib/model/player-comfort'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const accountId = sp.get('accountId')
  const heroId = sp.get('heroId')

  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
  }

  const id = Number(accountId)

  if (heroId) {
    const result = await getPlayerComfortOnHero(id, Number(heroId))
    return NextResponse.json(result)
  }

  const results = await getAllPlayerComfort(id)
  return NextResponse.json(results)
}
