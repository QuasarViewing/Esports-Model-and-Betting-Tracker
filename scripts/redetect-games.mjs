// One-off: re-run the (now smarter) detectGame logic against every existing bet
// in the DB. Use this after schema/heuristic changes, instead of clearing + re-importing.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envLocal = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envLocal.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)
  if (m) process.env[m[1]] ??= m[2]
}

// Inline copy of the parser's detectGame so this script has no TS build step.
function detectGame(match, selection) {
  const text = `${match} ${selection}`.toLowerCase()
  const isRoundsMarket = /\brounds?\b.*(over|under|handicap)|total rounds?/i.test(text)
  const DOTA2_TEAMS = ['team spirit','team falcons','tundra esports','tundra','parivision','playtime','aurora','vici gaming','gamerlegion','xtreme gaming','rekonix','ex-heroic','bb team','azure ray','tidebound','nigma','quest esports','talon esports','execration','boom esports']
  const LOL_TEAMS = ['hanwha life','kt rolster','gen.g','dplus kia','dplus','dwg kia','damwon','bilibili gaming','top esports','edward gaming','weibo gaming','lng esports','fnatic','mad lions koi','team bds','sk gaming','team heretics','rogue','excel esports']
  const VALORANT_TEAMS = ['loud','100 thieves','mibr','furia','shopify rebellion','disguised','sentinels','paper rex','drx','leviatán','leviatan','kru esports','2game esports','g2 esports','team heretics']
  const CS_TEAMS = ['vitality','faze clan','mouz','mousesports','astralis','big clan','ence','complexity','eternal fire','imperial esports','monte','falcons']
  const has = (list) => list.some(t => text.includes(t))
  if (isRoundsMarket) return has(VALORANT_TEAMS) ? 'valorant' : 'csgo'
  if (has(LOL_TEAMS)) return 'lol'
  if (has(VALORANT_TEAMS)) return 'valorant'
  if (has(DOTA2_TEAMS)) return 'dota2'
  if (has(CS_TEAMS)) return 'csgo'
  if (text.includes('dota')) return 'dota2'
  if (text.includes('league of legends') || text.includes(' lol ')) return 'lol'
  if (text.includes('valorant')) return 'valorant'
  if (text.includes('counter-strike') || text.includes('cs2') || text.includes('csgo')) return 'csgo'
  return 'dota2'
}

const url = (process.env.POSTGRES_URL_NON_POOLING || '')
  .replace(/[?&]sslmode=[^&]*/g, '')
  .replace(/[?&]uselibpqcompat=[^&]*/g, '')
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

try {
  const { rows } = await client.query('select id, match, selection, game from bets')
  let changed = 0
  for (const r of rows) {
    const next = detectGame(r.match, r.selection)
    if (next !== r.game) {
      await client.query('update bets set game = $1 where id = $2', [next, r.id])
      console.log(`  ${r.game.padEnd(8)} → ${next.padEnd(8)}  ${r.match} | ${r.selection}`)
      changed++
    }
  }
  console.log(`\nReclassified ${changed} of ${rows.length} bets.`)
} finally {
  await client.end()
}
