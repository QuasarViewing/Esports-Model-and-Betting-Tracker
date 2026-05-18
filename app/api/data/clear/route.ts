import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Delete all bets
    const { error: betsError } = await supabase
      .from('bets')
      .delete()
      .neq('id', '')

    if (betsError) {
      console.error('[v0] Error deleting bets:', betsError)
      return NextResponse.json({ error: 'Failed to delete bets' }, { status: 500 })
    }

    // Delete all transactions
    const { error: txError } = await supabase
      .from('transactions')
      .delete()
      .neq('id', '')

    if (txError) {
      console.error('[v0] Error deleting transactions:', txError)
      return NextResponse.json({ error: 'Failed to delete transactions' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'All data cleared successfully' })
  } catch (error) {
    console.error('[v0] Clear data error:', error)
    return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 })
  }
}
