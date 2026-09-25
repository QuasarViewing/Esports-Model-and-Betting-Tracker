import { NextResponse } from 'next/server'
import { getHeroMetaStats } from '@/lib/stratz'
import { getHeroStats } from '@/lib/opendota'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Try STRATZ first (Divine/Immortal bracket data)
  const stratzStats = await getHeroMetaStats()
  if (stratzStats && stratzStats.length > 0) {
    return NextResponse.json(stratzStats)
  }

  // Fall back to OpenDota heroStats (pro-level pick/win counts)
  const odStats = await getHeroStats()
  const fallback = odStats.map(h => ({
    heroId: h.id,
    matchCount: h.pro_pick,
    winCount: h.pro_win,
  }))
  return NextResponse.json(fallback)
}
