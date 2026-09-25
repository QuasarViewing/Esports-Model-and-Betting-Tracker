import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

// Parse .env.local into process.env
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

const sanitizedUrl = connectionString
  .replace(/[?&]sslmode=[^&]*/g, '')
  .replace(/[?&]uselibpqcompat=[^&]*/g, '')

export const pool = new pg.Pool({
  connectionString: sanitizedUrl,
  ssl: { rejectUnauthorized: false },
})
