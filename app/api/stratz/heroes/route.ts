import { NextResponse } from 'next/server'
import { getHeroConstants } from '@/lib/stratz'

export const dynamic = 'force-dynamic'

export async function GET() {
  const heroes = await getHeroConstants()
  return NextResponse.json(heroes)
}
