import { NextRequest, NextResponse } from 'next/server'
import { getPlayerHeroes } from '@/lib/opendota'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get('accountId')
  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
  }

  const heroes = await getPlayerHeroes(Number(accountId))
  return NextResponse.json(heroes)
}
