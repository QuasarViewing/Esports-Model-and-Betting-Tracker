import { NextResponse } from 'next/server'
import { getHeroes } from '@/lib/opendota'

export const dynamic = 'force-dynamic'

export async function GET() {
  const heroes = await getHeroes()
  return NextResponse.json(heroes)
}
