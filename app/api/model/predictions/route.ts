import { NextResponse } from 'next/server'
import { getPredictionHistory } from '@/lib/model-db'

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get('limit') ?? 50)
  const predictions = await getPredictionHistory(Number.isFinite(limit) ? limit : 50)
  return NextResponse.json({ predictions })
}
