import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    console.log('[v0] Starting data clear...')

    // Delete all bets - use a simple delete without filters
    const { error: betsError, count: betsCount } = await supabase
      .from('bets')
      .delete()
      .not('id', 'is', null)

    if (betsError) {
      console.error('[v0] Error deleting bets:', betsError)
      return NextResponse.json({ error: `Failed to delete bets: ${betsError.message}` }, { status: 500 })
    }

    console.log('[v0] Deleted', betsCount, 'bets')

    // Delete all transactions 
    const { error: txError, count: txCount } = await supabase
      .from('transactions')
      .delete()
      .not('id', 'is', null)

    if (txError) {
      console.error('[v0] Error deleting transactions:', txError)
      return NextResponse.json({ error: `Failed to delete transactions: ${txError.message}` }, { status: 500 })
    }

    console.log('[v0] Deleted', txCount, 'transactions')
    console.log('[v0] Data clear completed successfully')

    return NextResponse.json({ 
      success: true, 
      message: 'All data cleared successfully',
      deletedBets: betsCount,
      deletedTransactions: txCount
    })
  } catch (error) {
    console.error('[v0] Clear data error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to clear data: ${errorMsg}` }, { status: 500 })
  }
}

