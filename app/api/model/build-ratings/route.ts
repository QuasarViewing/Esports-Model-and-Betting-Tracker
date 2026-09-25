import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json({
    error: 'Team ratings are built via the populate-team-ratings.ts script (global chronological Elo). Run: npx tsx scripts/populate-team-ratings.ts',
  }, { status: 400 })
}
