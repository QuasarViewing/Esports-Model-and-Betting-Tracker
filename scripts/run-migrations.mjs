#!/usr/bin/env node
// One-off migration runner — applies every .sql file in supabase/migrations/ in name order.
// Uses POSTGRES_URL_NON_POOLING from .env.local (direct connection, not pgbouncer).
// Migrations use IF NOT EXISTS, so re-running is a no-op.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

// Tiny .env.local parser — avoids pulling dotenv just for this.
const envLocal = readFileSync(join(projectRoot, '.env.local'), 'utf8')
for (const line of envLocal.split('\n')) {
  const match = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)
  if (match) process.env[match[1]] ??= match[2]
}

const connectionString = process.env.POSTGRES_URL_NON_POOLING
if (!connectionString) {
  console.error('POSTGRES_URL_NON_POOLING missing from .env.local')
  process.exit(1)
}

const migrationsDir = join(projectRoot, 'supabase', 'migrations')
const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()

// Strip sslmode from the URL — recent pg versions promote `sslmode=require` to verify-full,
// which fails against Supabase's pooler cert chain. We re-add SSL ourselves below.
const sanitizedUrl = connectionString.replace(/[?&]sslmode=[^&]*/g, '').replace(/[?&]uselibpqcompat=[^&]*/g, '')

const client = new pg.Client({ connectionString: sanitizedUrl, ssl: { rejectUnauthorized: false } })
await client.connect()

try {
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    process.stdout.write(`→ ${file} … `)
    await client.query(sql)
    console.log('ok')
  }
  console.log(`\nApplied ${files.length} migration file(s).`)
} finally {
  await client.end()
}
