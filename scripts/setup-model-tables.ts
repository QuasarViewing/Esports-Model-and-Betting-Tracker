#!/usr/bin/env npx tsx
// Creates all model tables via direct Postgres connection.
// Run: npx tsx scripts/setup-model-tables.ts
// Uses POSTGRES_URL_NON_POOLING from .env.local (same as run-migrations.mjs).

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

// Parse .env.local
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

const sql = readFileSync(
  join(projectRoot, 'supabase', 'migrations', '001_model_tables.sql'),
  'utf8',
)

const sanitizedUrl = connectionString
  .replace(/[?&]sslmode=[^&]*/g, '')
  .replace(/[?&]uselibpqcompat=[^&]*/g, '')

const client = new pg.Client({
  connectionString: sanitizedUrl,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  await client.connect()
  try {
    console.log('Creating model tables...')
    await client.query(sql)

    // Also run the patch_predictions migration if it exists
    const patchSql = join(projectRoot, 'supabase', 'migrations', '002_patch_predictions.sql')
    try {
      const sql2 = readFileSync(patchSql, 'utf8')
      await client.query(sql2)
      console.log('Patch predictions table created.')
    } catch { /* file may not exist yet */ }

    console.log('All model tables created successfully.')
  } catch (err) {
    console.error('Failed to create tables:', err)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main().catch(console.error)
