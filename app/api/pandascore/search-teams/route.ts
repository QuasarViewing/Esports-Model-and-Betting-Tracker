import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const VIDEOGAME_ID: Record<string, number> = {
  dota2: 4,
  lol: 1,
  csgo: 3,
  valorant: 26,
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const q = sp.get('q')?.trim()
  const game = (sp.get('game') || 'dota2') as keyof typeof VIDEOGAME_ID

  if (!q || q.length < 2) return NextResponse.json([])

  const apiKey = process.env.PANDASCORE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'PANDASCORE_API_KEY not set' }, { status: 500 })

  const params = new URLSearchParams({
    'filter[videogame_id]': String(VIDEOGAME_ID[game]),
    'search[name]': q,
    per_page: '6',
  })

  try {
    const res = await fetch(`https://api.pandascore.co/teams?${params}`, {
      headers: { accept: 'application/json', authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) return NextResponse.json([])
    const teams = await res.json()
    if (!Array.isArray(teams)) return NextResponse.json([])

    return NextResponse.json(
      teams.map((t: any) => ({
        id: t.id,
        name: t.name,
        acronym: t.acronym,
        image_url: t.image_url,
      }))
    )
  } catch (error) {
    console.error('[search-teams] error:', error)
    return NextResponse.json([])
  }
}
