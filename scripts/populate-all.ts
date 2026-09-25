import { execSync } from 'child_process'

const scripts = [
  { name: 'Hero Meta', cmd: 'npx tsx scripts/populate-hero-meta.ts' },
  { name: 'Hero Matchups', cmd: 'npx tsx scripts/populate-hero-matchups.ts' },
  { name: 'Team Ratings', cmd: 'npx tsx scripts/populate-team-ratings.ts' },
  { name: 'Player Stats', cmd: 'npx tsx scripts/populate-player-stats.ts' },
]

async function main() {
  console.log('=== Populate All Model Data ===\n')

  for (const script of scripts) {
    console.log(`\n--- ${script.name} ---`)
    try {
      execSync(script.cmd, { stdio: 'inherit', cwd: process.cwd() })
      console.log(`--- ${script.name}: DONE ---`)
    } catch (err) {
      console.error(`--- ${script.name}: FAILED ---`)
      console.error(err)
    }
  }

  console.log('\n=== All population scripts complete ===')
}

main()
