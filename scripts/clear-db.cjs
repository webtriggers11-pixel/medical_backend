/* eslint-disable */
// One-off: wipe ALL application data from the database, preserving schema and
// the Prisma migration history. TRUNCATE ... CASCADE handles FK order.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const client = new Client({ connectionString: url });
  await client.connect();

  const { rows } = await client.query(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
     ORDER BY tablename`,
  );
  const tables = rows.map((r) => r.tablename);

  if (tables.length === 0) {
    console.log('No application tables found. Nothing to clear.');
    await client.end();
    return;
  }

  // Row counts before, for the report.
  const before = {};
  for (const t of tables) {
    const c = await client.query(`SELECT COUNT(*)::int AS n FROM "${t}"`);
    before[t] = c.rows[0].n;
  }

  const list = tables.map((t) => `"${t}"`).join(', ');
  await client.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);

  console.log('Cleared tables (rows deleted):');
  for (const t of tables) console.log(`  ${t}: ${before[t]}`);
  const total = Object.values(before).reduce((a, b) => a + b, 0);
  console.log(`\nDone. ${total} rows deleted across ${tables.length} tables. Schema + migrations preserved.`);

  await client.end();
}

main().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
