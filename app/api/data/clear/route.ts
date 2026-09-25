import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Delete all bets - use gt() with a date from the past to match all records
    const { error: betsError } = await supabase
      .from('bets')
      .delete()
      .gt('created_at', '1900-01-01')

    if (betsError) {
      console.error('Error deleting bets:', betsError)
      return NextResponse.json({ error: `Failed to delete bets: ${betsError.message}` }, { status: 500 })
    }

    // Delete all transactions - use gt() with a date from the past to match all records
    const { error: txError } = await supabase
      .from('transactions')
      .delete()
      .gt('created_at', '1900-01-01')

    if (txError) {
      console.error('Error deleting transactions:', txError)
      return NextResponse.json({ error: `Failed to delete transactions: ${txError.message}` }, { status: 500 })
    }

    console.log('Data clear completed successfully')

    return NextResponse.json({ 
      success: true, 
      message: 'All data cleared successfully'
    })
  } catch (error) {
    console.error('Clear data error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to clear data: ${errorMsg}` }, { status: 500 })
  }
}